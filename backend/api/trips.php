<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

$pdo = get_pdo();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
  send_error('Method not allowed', 405);
}

// Filters: from, to, date (YYYY-MM-DD)
$from = isset($_GET['from']) ? trim($_GET['from']) : null;
$to = isset($_GET['to']) ? trim($_GET['to']) : null;
$date = isset($_GET['date']) ? trim($_GET['date']) : null;
$driverId = isset($_GET['driver_id']) ? (int)$_GET['driver_id'] : null;

$where = [];
$params = [];
if ($from) { $where[] = 'r.start_point = ?'; $params[] = $from; }
if ($to) { $where[] = 'r.end_point = ?'; $params[] = $to; }
if ($date) { $where[] = 'DATE(t.departure_datetime) = ?'; $params[] = $date; }
if ($driverId) { $where[] = 't.driver_id = ?'; $params[] = $driverId; }

$sql = "SELECT t.id, t.bus_id, t.route_id, t.driver_id, t.departure_datetime, t.arrival_estimated, t.base_fare, t.status,
               b.number AS bus_number, b.type AS bus_type, b.capacity,
               r.name AS route_name, r.start_point, r.end_point
        FROM trips t
        JOIN buses b ON t.bus_id = b.id
        JOIN routes r ON t.route_id = r.id";
if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
$sql .= ' ORDER BY t.departure_datetime ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();
send_json($rows);
