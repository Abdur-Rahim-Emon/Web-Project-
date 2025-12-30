<?php
// Load backend config/db helpers
require_once __DIR__ . '/../backend/config.php';
require_once __DIR__ . '/../backend/db.php';

// Simple return handler for SSLCommerz redirect (user-facing).
// SSLCommerz may send GET or POST parameters including tran_id and status.

$data = $_POST ?: $_GET;
$tran = isset($data['tran_id']) ? $data['tran_id'] : (isset($data['tran']) ? $data['tran'] : null);
$status = isset($data['status']) ? $data['status'] : null;

// Some SSLCommerz success redirects don't include a simple "status" field.
// Only infer success when common success indicators exist.
if ($tran && ($status === null || $status === '')) {
  if (isset($data['val_id']) || isset($data['verify_sign']) || isset($data['verify_key'])) {
    $status = 'success';
  } else {
    $status = 'unknown';
  }
}

$bookingUpdated = false;
$updatedCount = 0;
$slipUrl = null;

if ($tran) {
    try {
        $pdo = get_pdo();
    $normalizedStatus = strtolower(trim((string)($status ?: 'unknown')));

    // Update payment status + keep raw response (do not overwrite existing raw_response).
    $stmt = $pdo->prepare('UPDATE payments SET status = :status, raw_response = COALESCE(raw_response, :raw) WHERE tran_id = :tran');
    $stmt->execute([
      ':status' => $normalizedStatus,
      ':raw' => json_encode($data),
      ':tran' => $tran,
    ]);

    // Auto-confirm bookings if payment is successful.
    $okStatuses = ['success','valid','validated'];
    if (in_array($normalizedStatus, $okStatuses, true)) {
      $stmt2 = $pdo->prepare('SELECT raw_response FROM payments WHERE tran_id = :tran LIMIT 1');
      $stmt2->execute([':tran' => $tran]);
      $payRow = $stmt2->fetch(PDO::FETCH_ASSOC);
      $raw = $payRow ? $payRow['raw_response'] : null;
      $bookingIds = [];

      if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && isset($decoded['booking_ids'])) {
          $csv = is_string($decoded['booking_ids']) ? $decoded['booking_ids'] : '';
          if ($csv !== '') {
            $bookingIds = array_values(array_filter(array_map('intval', explode(',', $csv))));
          }
        }
      }

      if (count($bookingIds) > 0) {
        $in = implode(',', array_fill(0, count($bookingIds), '?'));
        $sql = "UPDATE bookings SET payment_status = 'paid' WHERE id IN ($in)";
        $u = $pdo->prepare($sql);
        $u->execute($bookingIds);
        $updatedCount = (int)$u->rowCount();
        $bookingUpdated = true;
        $slipUrl = 'payment_slip.php?tran_id=' . urlencode($tran) . '&booking_ids=' . urlencode(implode(',', $bookingIds));
      }
    }
    } catch (Exception $e) {
        // ignore
    }
}

?><!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Payment Result</title>
    <style>body{font-family: Arial,Helvetica,sans-serif;padding:20px}</style>
  </head>
  <body>
    <h2>Payment Result</h2>
    <p>Transaction: <strong><?= htmlspecialchars($tran ?? 'unknown') ?></strong></p>
    <p>Status: <strong><?= htmlspecialchars($status ?? 'unknown') ?></strong></p>
    <?php if ($bookingUpdated): ?>
      <p><strong>Booking confirmed.</strong> Updated bookings: <?= (int)$updatedCount ?></p>
      <?php if ($slipUrl): ?>
        <p><a href="<?= htmlspecialchars($slipUrl) ?>" target="_blank" rel="noopener">Open Payment Slip</a></p>
      <?php endif; ?>
    <?php else: ?>
      <p>If this was a successful payment, it may take a few seconds to reflect in the application.</p>
    <?php endif; ?>
    <p><a href="../search.html">Return to Search</a> · <a href="../passenger.html">Return to Dashboard</a></p>
  </body>
</html>
