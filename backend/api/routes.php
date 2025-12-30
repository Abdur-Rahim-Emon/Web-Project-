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
      $stmt = $pdo->prepare('SELECT * FROM routes WHERE id = ?');
      $stmt->execute([(int)$_GET['id']]);
      $row = $stmt->fetch();
      if (!$row) send_error('Route not found', 404);
      send_json($row);
    }
    $stmt = $pdo->query('SELECT * FROM routes ORDER BY id DESC');
    send_json($stmt->fetchAll());
    break;

  case 'POST':
    $data = read_json_body();
    require_fields($data, ['name','start_point','end_point','stops']);
    $stops = is_array($data['stops']) ? $data['stops'] : [];
    $stmt = $pdo->prepare('INSERT INTO routes (bus_id,name,start_point,end_point,stops_json,distance_km,duration_minutes) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([
      isset($data['bus_id']) ? (int)$data['bus_id'] : null,
      sanitize_string($data['name']),
      sanitize_string($data['start_point']),
      sanitize_string($data['end_point']),
      json_encode($stops, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
      isset($data['distance_km']) ? (float)$data['distance_km'] : null,
      isset($data['duration_minutes']) ? (int)$data['duration_minutes'] : null
    ]);
    send_json(['id' => $pdo->lastInsertId()], 201);
    break;

  case 'PUT':
    if (!isset($_GET['id'])) send_error('Missing id', 400);
    $id = (int)$_GET['id'];
    $data = read_json_body();
    require_fields($data, ['name','start_point','end_point','stops']);
    $stops = is_array($data['stops']) ? $data['stops'] : [];
    $stmt = $pdo->prepare('UPDATE routes SET bus_id=?, name=?, start_point=?, end_point=?, stops_json=?, distance_km=?, duration_minutes=? WHERE id=?');
    $stmt->execute([
      isset($data['bus_id']) ? (int)$data['bus_id'] : null,
      sanitize_string($data['name']),
      sanitize_string($data['start_point']),
      sanitize_string($data['end_point']),
      json_encode($stops, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
      isset($data['distance_km']) ? (float)$data['distance_km'] : null,
      isset($data['duration_minutes']) ? (int)$data['duration_minutes'] : null,
      $id
    ]);
    if ($stmt->rowCount() === 0) {
      send_error('Route not found or no changes', 404);
    }
    send_json(['updated' => true]);
    break;

  case 'DELETE':
    if (!isset($_GET['id'])) send_error('Missing id', 400);
    $id = (int)$_GET['id'];
    $stmt = $pdo->prepare('DELETE FROM routes WHERE id=?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) {
      send_error('Route not found', 404);
    }
    send_json(['deleted' => true]);
    break;

  default:
    send_error('Method not allowed', 405);
}
