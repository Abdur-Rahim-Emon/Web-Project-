<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

$pdo = get_pdo();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
  case 'GET':
    if (isset($_GET['id'])) {
      $stmt = $pdo->prepare('SELECT * FROM drivers WHERE id = ?');
      $stmt->execute([(int)$_GET['id']]);
      $row = $stmt->fetch();
      if (!$row) send_error('Driver not found',404);
      send_json($row);
    }
    $stmt = $pdo->query('SELECT * FROM drivers ORDER BY id DESC');
    send_json($stmt->fetchAll());
  case 'POST':
    $data = read_json_body();
    require_fields($data,['name','license_number','phone']);
    $stmt=$pdo->prepare('INSERT INTO drivers (name,license_number,phone) VALUES (?,?,?)');
    $stmt->execute([
      sanitize_string($data['name']),
      sanitize_string($data['license_number']),
      sanitize_string($data['phone'])
    ]);
    send_json(['id'=>$pdo->lastInsertId()],201);
  case 'PUT':
    if(!isset($_GET['id'])) send_error('Missing id',400);
    $id=(int)$_GET['id'];
    $data=read_json_body();
    require_fields($data,['name','license_number','phone']);
    $stmt=$pdo->prepare('UPDATE drivers SET name=?, license_number=?, phone=? WHERE id=?');
    $stmt->execute([
      sanitize_string($data['name']),
      sanitize_string($data['license_number']),
      sanitize_string($data['phone']),
      $id
    ]);
    send_json(['updated'=>true]);
  case 'DELETE':
    if(!isset($_GET['id'])) send_error('Missing id',400);
    $id=(int)$_GET['id'];
    $stmt=$pdo->prepare('DELETE FROM drivers WHERE id=?');
    $stmt->execute([$id]);
    send_json(['deleted'=>true]);
  default:
    send_error('Method not allowed',405);
}
