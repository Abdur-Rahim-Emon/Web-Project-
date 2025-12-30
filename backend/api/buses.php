<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

$pdo = get_pdo();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
  case 'GET':
    // /api/buses.php?id=1 for single
    if (isset($_GET['id'])) {
      $stmt = $pdo->prepare('SELECT * FROM buses WHERE id = ?');
      $stmt->execute([(int)$_GET['id']]);
      $bus = $stmt->fetch();
      if (!$bus) send_error('Bus not found', 404);
      send_json($bus);
    } else {
      $stmt = $pdo->query('SELECT * FROM buses ORDER BY id DESC');
      send_json($stmt->fetchAll());
    }
    break;
  case 'POST':
    $data = read_json_body();
    require_fields($data, ['number','type','capacity','status_condition']);
    $stmt = $pdo->prepare('INSERT INTO buses (number,type,capacity,status_condition) VALUES (?,?,?,?)');
    $stmt->execute([
      sanitize_string($data['number']),
      sanitize_string($data['type']),
      (int)$data['capacity'],
      sanitize_string($data['status_condition'])
    ]);
    send_json(['id' => $pdo->lastInsertId()], 201);
    break;
  case 'PUT':
    if (!isset($_GET['id'])) send_error('Missing id', 400);
    $id = (int)$_GET['id'];
    $data = read_json_body();
    require_fields($data, ['number','type','capacity','status_condition']);
    $stmt = $pdo->prepare('UPDATE buses SET number = ?, type = ?, capacity = ?, status_condition = ? WHERE id = ?');
    $stmt->execute([
      sanitize_string($data['number']),
      sanitize_string($data['type']),
      (int)$data['capacity'],
      sanitize_string($data['status_condition']),
      $id
    ]);
    send_json(['updated' => true]);
    break;
  case 'DELETE':
    if (!isset($_GET['id'])) send_error('Missing id', 400);
    $id = (int)$_GET['id'];
    $stmt = $pdo->prepare('DELETE FROM buses WHERE id = ?');
    $stmt->execute([$id]);
    send_json(['deleted' => true]);
    break;
  default:
    send_error('Method not allowed', 405);
}
