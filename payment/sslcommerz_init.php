<?php
// Load backend config/db from parent backend directory
require_once __DIR__ . '/../backend/config.php';
require_once __DIR__ . '/../backend/db.php';

header('Content-Type: application/json');

$amount = isset($_REQUEST['amount']) ? trim($_REQUEST['amount']) : null;
$tran_id = isset($_REQUEST['tran_id']) ? trim($_REQUEST['tran_id']) : null;
$desc = isset($_REQUEST['desc']) ? trim($_REQUEST['desc']) : '';
$customer_id = isset($_REQUEST['customer_id']) ? trim($_REQUEST['customer_id']) : null;
$shop_id = isset($_REQUEST['shop_id']) ? trim($_REQUEST['shop_id']) : null;
// optional CSV of booking IDs associated with this payment
$booking_ids = isset($_REQUEST['booking_ids']) ? trim($_REQUEST['booking_ids']) : null;

if (!$amount || !$tran_id) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing amount or tran_id']);
    exit;
}

$total = number_format((float)$amount, 2, '.', '');

// Decide gateway endpoint based on sandbox flag
$endpoint = SSL_SANDBOX
    ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

// Build base URL dynamically so it works even when the app
// is served from a subfolder like /download
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
$baseUrl = $scheme . '://' . $host . $basePath;

$payload = [
    'store_id' => SSL_STORE_ID,
    'store_passwd' => SSL_STORE_PASS,
    'total_amount' => $total,
    'currency' => 'BDT',
    'tran_id' => $tran_id,
    // Callback URLs (include correct subfolder)
    'success_url' => $baseUrl . '/sslcommerz_return.php',
    'fail_url' => $baseUrl . '/sslcommerz_return.php?status=fail',
    'cancel_url' => $baseUrl . '/sslcommerz_return.php?status=cancel',
    'ipn_url' => $baseUrl . '/sslcommerz_ipn.php',

    // Required / recommended business parameters (aligned with docs)
    // Use a generic non-physical profile so we do not need
    // hotel_name / airline-specific fields.
    'product_category' => 'bus ticket',
    'product_profile' => 'non-physical-goods',
    'product_name' => substr($desc !== '' ? $desc : 'Bus ticket booking', 0, 100),

    // Customer info – use safe defaults if not provided
    'cus_name' => 'Customer',
    'cus_email' => 'no-reply@example.com',
    'cus_add1' => 'Dhaka',
    'cus_add2' => 'Dhaka',
    'cus_city' => 'Dhaka',
    'cus_state' => 'Dhaka',
    'cus_postcode' => '1000',
    'cus_country' => 'Bangladesh',
    'cus_phone' => $customer_id ?: '01700000000',

    // Shipping / logistic fields – disabled, but populated with sane values
    'shipping_method' => 'NO',
    'num_of_item' => 1,
    'ship_name' => 'Customer',
    'ship_add1' => 'Dhaka',
    'ship_add2' => 'Dhaka',
    'ship_city' => 'Dhaka',
    'ship_state' => 'Dhaka',
    'ship_postcode' => '1000',
    'ship_country' => 'Bangladesh',

    // EMI disabled explicitly
    'emi_option' => 0,
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $endpoint);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$resp = curl_exec($ch);
$err = curl_error($ch);
curl_close($ch);

if ($resp === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Curl error', 'detail' => $err]);
    exit;
}

$data = json_decode($resp, true);
if (!$data) {
    echo json_encode(['error' => 'Invalid response from SSLCommerz', 'raw' => $resp]);
    exit;
}

// Example response contains 'GatewayPageURL'
if (!empty($data['GatewayPageURL'])) {
    // Optionally pre-create a DB record with pending status
    try {
        $pdo = get_pdo();
        $stmt = $pdo->prepare('INSERT INTO payments (tran_id, amount, currency, gateway, status, customer_id, shop_id, raw_response) VALUES (:tran, :amount, :currency, :gateway, :status, :customer, :shop, :raw) ON DUPLICATE KEY UPDATE raw_response = :raw2');
        $stmt->execute([
            ':tran' => $tran_id,
            ':amount' => $total,
            ':currency' => 'BDT',
            ':gateway' => 'sslcommerz',
            ':status' => 'initiated',
            ':customer' => $customer_id,
            ':shop' => $shop_id,
            ':raw' => json_encode(array_merge($data, ['booking_ids' => $booking_ids])),
            ':raw2' => json_encode(array_merge($data, ['booking_ids' => $booking_ids])),
        ]);
    } catch (Exception $e) {
        // ignore DB errors but return the URL
    }

    echo json_encode(['gateway_url' => $data['GatewayPageURL']]);
    exit;
}

// Return whole response if no gateway URL so caller can inspect status
$status = isset($data['status']) ? $data['status'] : null;
$failed = isset($data['failedreason']) ? $data['failedreason'] : null;
echo json_encode([
    'error' => 'No GatewayPageURL',
    'status' => $status,
    'failedreason' => $failed,
    'response' => $data,
]);
