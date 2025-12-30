<?php
// Load backend config/db/response helpers
require_once __DIR__ . '/../backend/config.php';
require_once __DIR__ . '/../backend/db.php';
require_once __DIR__ . '/../backend/response.php';

// This endpoint receives POST { tran_id: string, booking_ids: [int,...] }
// It checks the payments table for the tran_id status and if success, updates bookings.payment_status to 'paid' for provided booking ids.

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  send_error('Method not allowed', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) send_error('Invalid body', 400);
$tran = isset($body['tran_id']) ? trim($body['tran_id']) : null;
$booking_ids = isset($body['booking_ids']) && is_array($body['booking_ids']) ? $body['booking_ids'] : [];
if (!$tran || count($booking_ids) === 0) send_error('Missing tran_id or booking_ids', 400);

try {
  $pdo = get_pdo();
  $stmt = $pdo->prepare('SELECT status FROM payments WHERE tran_id = :tran LIMIT 1');
  $stmt->execute([':tran' => $tran]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$row) send_error('Payment not found', 404);
  $status = strtolower(trim((string)$row['status']));
  // SSLCommerz can report success in multiple equivalent strings.
  $okStatuses = ['success','valid','validated'];
  if (!in_array($status, $okStatuses, true)) {
    send_json(['ok' => false, 'message' => 'Payment not successful', 'status' => $row['status']]);
    exit;
  }

  // Update bookings
  $in = implode(',', array_fill(0, count($booking_ids), '?'));
  $params = $booking_ids;
  $sql = "UPDATE bookings SET payment_status = 'paid' WHERE id IN ($in)";
  $stmt2 = $pdo->prepare($sql);
  $stmt2->execute($params);

  // Provide a slip URL so UI can show/print receipt
  $csv = implode(',', array_map('intval', $booking_ids));
  $slipUrl = 'payment/payment_slip.php?tran_id=' . urlencode($tran) . '&booking_ids=' . urlencode($csv);

  send_json(['ok' => true, 'updated' => $stmt2->rowCount(), 'slip_url' => $slipUrl]);
} catch (Exception $e) {
  send_error('Server error', 500, ['details' => $e->getMessage()]);
}
