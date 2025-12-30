<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  send_error('Method not allowed', 405);
}

$data = read_json_body();
require_fields($data, ['phone','license_number']);
$pdo = get_pdo();

$phone = sanitize_string($data['phone']);
$license = sanitize_string($data['license_number']);

$stmt = $pdo->prepare('SELECT id, name, phone, license_number, active FROM drivers WHERE phone = ? AND license_number = ?');
$stmt->execute([$phone, $license]);
$row = $stmt->fetch();
if (!$row) {
  send_error('Invalid credentials', 401);
}
if ((int)$row['active'] !== 1) {
  send_error('Account not active', 403);
}

// Simple demo token (not secure). For production use JWT or sessions.
$token = base64_encode($row['id'] . ':' . sha1($row['phone'] . microtime(true)));
send_json(['token' => $token, 'driver' => [
  'id' => (int)$row['id'],
  'name' => $row['name'],
  'phone' => $row['phone'],
  'license_number' => $row['license_number']
]]);
