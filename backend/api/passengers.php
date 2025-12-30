<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

$pdo = get_pdo();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
  case 'POST': {
    // Signup passenger
    $data = read_json_body();
    require_fields($data, ['full_name','mobile','password']);
    $full_name = sanitize_string($data['full_name']);
    $mobile = sanitize_string($data['mobile']);
    $email = isset($data['email']) && $data['email'] !== '' ? sanitize_string($data['email']) : null;
    if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
      send_error('Invalid email format', 422);
    }
    $status = isset($data['status']) && $data['status'] === 'blocked' ? 'blocked' : 'active';
    $hash = password_hash($data['password'], PASSWORD_BCRYPT);

    // Duplicate check (mobile or email if provided)
    $check = $pdo->prepare('SELECT id FROM passengers WHERE mobile = ? OR ( ? IS NOT NULL AND email = ? ) LIMIT 1');
    $check->execute([$mobile, $email, $email]);
    if ($check->fetch()) send_error('Passenger already exists', 409);

    try {
      $stmt = $pdo->prepare('INSERT INTO passengers (full_name,mobile,email,password_hash,status) VALUES (?,?,?,?,?)');
      $stmt->execute([$full_name, $mobile, $email, $hash, $status]);
      $newId = $pdo->lastInsertId();
      send_json(['id' => $newId, 'status' => $status]);
    } catch (PDOException $e) {
      send_error('Database insert failed', 500, ['detail' => $e->getMessage()]);
    }
    break;
  }
  case 'GET': {
    // Fetch one or list all (basic, not secured)
    if (isset($_GET['id'])) {
      $stmt = $pdo->prepare('SELECT id,full_name,mobile,email,status,created_at,updated_at FROM passengers WHERE id = ?');
      $stmt->execute([(int)$_GET['id']]);
      $row = $stmt->fetch();
      if (!$row) send_error('Passenger not found', 404);
      send_json($row);
    }
    $stmt = $pdo->query('SELECT id,full_name,mobile,email,status,created_at,updated_at FROM passengers ORDER BY id DESC');
    send_json($stmt->fetchAll());
    break;
  }
  default:
    send_error('Method not allowed', 405);
}
