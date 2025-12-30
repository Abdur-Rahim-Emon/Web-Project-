<?php
// Load backend config/db helpers
require_once __DIR__ . '/../backend/config.php';
require_once __DIR__ . '/../backend/db.php';

// Read POST body
$post = $_POST;

if (empty($post)) {
    // Some providers send JSON body
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) $post = $decoded;
}

$tran_id = isset($post['tran_id']) ? $post['tran_id'] : (isset($post['tran_id']) ? $post['tran_id'] : null);
$status = isset($post['status']) ? $post['status'] : (isset($post['status']) ? $post['status'] : null);
$amount = isset($post['amount']) ? $post['amount'] : null;
$currency = isset($post['currency']) ? $post['currency'] : (isset($post['currency_type']) ? $post['currency_type'] : 'BDT');

if (!$tran_id) {
    http_response_code(400);
    echo 'Missing tran_id';
    exit;
}

try {
    $pdo = get_pdo();
    // Upsert payment record
    $stmt = $pdo->prepare('INSERT INTO payments (tran_id, amount, currency, gateway, status, raw_response) VALUES (:tran, :amount, :currency, :gateway, :status, :raw) ON DUPLICATE KEY UPDATE status = :status2, raw_response = :raw2');
    $stmt->execute([
        ':tran' => $tran_id,
        ':amount' => $amount ?: 0,
        ':currency' => $currency ?: 'BDT',
        ':gateway' => 'sslcommerz',
        ':status' => $status ?: 'unknown',
        ':raw' => json_encode($post),
        ':status2' => $status ?: 'unknown',
        ':raw2' => json_encode($post),
    ]);
} catch (Exception $e) {
    http_response_code(500);
    error_log('IPN DB error: ' . $e->getMessage());
    echo 'DB error';
    exit;
}

// Respond OK to SSLCommerz
echo 'OK';
