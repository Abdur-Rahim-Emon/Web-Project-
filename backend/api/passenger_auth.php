<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  send_error('Method not allowed', 405);
}

$data = read_json_body();
require_fields($data, ['mobile','password']);
$pdo = get_pdo();

$stmt = $pdo->prepare('SELECT id, full_name, mobile, email, password_hash, status FROM passengers WHERE mobile = ?');
$stmt->execute([$data['mobile']]);
$row = $stmt->fetch();
if (!$row || !password_verify($data['password'], $row['password_hash'])) {
  send_error('Invalid credentials', 401);
}
if ($row['status'] !== 'active') {
  send_error('Account not active', 403);
}

// Simple demo token (not secure). For production use JWT or sessions.
$token = base64_encode($row['id'] . ':' . sha1($row['mobile'] . microtime(true)));
send_json(['token' => $token, 'passenger' => [
  'id' => (int)$row['id'],
  'full_name' => $row['full_name'],
  'mobile' => $row['mobile'],
  'email' => $row['email']
]]);
