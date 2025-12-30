<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

$pdo = get_pdo();
$method = $_SERVER['REQUEST_METHOD'];

try {
  switch ($method) {
    case 'GET':
      // Admin list of all trips with bus/route info (no filters)
      $sql = "SELECT t.id, t.bus_id, t.route_id, t.driver_id, t.departure_datetime, t.arrival_estimated, t.base_fare, t.status,
                     b.number AS bus_number, b.type AS bus_type, b.capacity,
                     r.name AS route_name, r.start_point, r.end_point
              FROM trips t
              JOIN buses b ON t.bus_id = b.id
              JOIN routes r ON t.route_id = r.id
              ORDER BY t.departure_datetime DESC";
      $stmt = $pdo->query($sql);
      send_json($stmt->fetchAll());

    case 'POST':
      $data = read_json_body();
      require_fields($data, ['bus_id','route_id','departure_datetime','base_fare']);
      $stmt = $pdo->prepare('INSERT INTO trips (bus_id, route_id, driver_id, departure_datetime, arrival_estimated, base_fare, status) VALUES (?,?,?,?,?,?,?)');
      $stmt->execute([
        (int)$data['bus_id'],
        (int)$data['route_id'],
        isset($data['driver_id']) && $data['driver_id'] !== null && $data['driver_id'] !== '' ? (int)$data['driver_id'] : null,
        $data['departure_datetime'],
        isset($data['arrival_estimated']) && $data['arrival_estimated'] !== '' ? $data['arrival_estimated'] : null,
        (float)$data['base_fare'],
        isset($data['status']) ? sanitize_string($data['status']) : 'scheduled',
      ]);
      send_json(['id' => $pdo->lastInsertId()], 201);

    case 'PUT':
      if (!isset($_GET['id'])) send_error('Missing id', 400);
      $id = (int)$_GET['id'];
      $data = read_json_body();
      require_fields($data, ['bus_id','route_id','departure_datetime','base_fare']);

      $check = $pdo->prepare('SELECT 1 FROM trips WHERE id = ?');
      $check->execute([$id]);
      if (!$check->fetchColumn()) send_error('Trip not found', 404);

      $stmt = $pdo->prepare('UPDATE trips SET bus_id=?, route_id=?, driver_id=?, departure_datetime=?, arrival_estimated=?, base_fare=?, status=? WHERE id=?');
      $stmt->execute([
        (int)$data['bus_id'],
        (int)$data['route_id'],
        isset($data['driver_id']) && $data['driver_id'] !== null && $data['driver_id'] !== '' ? (int)$data['driver_id'] : null,
        $data['departure_datetime'],
        isset($data['arrival_estimated']) && $data['arrival_estimated'] !== '' ? $data['arrival_estimated'] : null,
        (float)$data['base_fare'],
        isset($data['status']) ? sanitize_string($data['status']) : 'scheduled',
        $id
      ]);
      send_json(['updated' => true]);

    case 'DELETE':
      if (!isset($_GET['id'])) send_error('Missing id', 400);
      $id = (int)$_GET['id'];
      $stmt = $pdo->prepare('DELETE FROM trips WHERE id = ?');
      $stmt->execute([$id]);
      if ($stmt->rowCount() === 0) send_error('Trip not found', 404);
      send_json(['deleted' => true]);

    default:
      send_error('Method not allowed', 405);
  }
} catch (Throwable $e) {
  send_error('Server error', 500, ['detail' => $e->getMessage()]);
}
