<?php
// Driver-controlled trip status update (mark as completed)
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  send_error('Method not allowed', 405);
}

$data = read_json_body();
require_fields($data, ['trip_id','driver_id','status']);

$tripId = (int)$data['trip_id'];
$driverId = (int)$data['driver_id'];
$newStatus = sanitize_string($data['status']);

// Allow only marking completed (extendable later)
$allowed = ['completed'];
if (!in_array($newStatus, $allowed, true)) {
  send_error('Unsupported status change', 400);
}

$pdo = get_pdo();

$stmt = $pdo->prepare('SELECT id, driver_id, status FROM trips WHERE id = ?');
$stmt->execute([$tripId]);
$trip = $stmt->fetch();
if (!$trip) {
  send_error('Trip not found', 404);
}

if ((int)$trip['driver_id'] !== $driverId) {
  send_error('Not authorized for this trip', 403);
}

if ($trip['status'] === $newStatus) {
  send_json(['updated' => false, 'status' => $trip['status']]);
}

$update = $pdo->prepare('UPDATE trips SET status = ? WHERE id = ?');
$update->execute([$newStatus, $tripId]);

send_json(['updated' => true, 'status' => $newStatus, 'trip_id' => $tripId]);
