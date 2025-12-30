<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  send_error('Method not allowed', 405);
}

if (!isset($_GET['trip_id'])) {
  send_error('Missing trip_id', 400);
}

$pdo = get_pdo();
$trip_id = (int)$_GET['trip_id'];

// Get bus for trip
$stmt = $pdo->prepare('SELECT t.id, t.bus_id, b.capacity FROM trips t JOIN buses b ON t.bus_id=b.id WHERE t.id=?');
$stmt->execute([$trip_id]);
$trip = $stmt->fetch();
if (!$trip) send_error('Trip not found', 404);

// Seats can be defined in seats table; if empty, generate a simple A/B pattern up to capacity
$stmt = $pdo->prepare('SELECT seat_number, class FROM seats WHERE bus_id = ? AND active = 1 ORDER BY id ASC');
$stmt->execute([$trip['bus_id']]);
$seatRows = $stmt->fetchAll();
if (!$seatRows) {
  $seatRows = [];
  for ($i=1; $i <= (int)$trip['capacity']/2; $i++) {
    $seatRows[] = ['seat_number' => $i.'A', 'class' => 'regular'];
    $seatRows[] = ['seat_number' => $i.'B', 'class' => 'regular'];
  }
}

// Get booked seats for this trip
// Fetch booked seats (active)
$stmt = $pdo->prepare("SELECT seat_number FROM bookings WHERE trip_id = ? AND booking_status = 'active'");
$stmt->execute([$trip_id]);
$booked = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));

// Pricing strategy: base fare * multiplier by seat class
$baseFare = 0.0; // fallback if base_fare not present
$fareStmt = $pdo->prepare('SELECT base_fare FROM trips WHERE id = ?');
$fareStmt->execute([$trip_id]);
$fareRow = $fareStmt->fetch();
if ($fareRow && isset($fareRow['base_fare'])) {
  $baseFare = (float)$fareRow['base_fare'];
}
$classMultiplier = [
  'regular' => 1.0,
  'premium' => 1.25,
  'sleeper' => 1.5
];

$result = [];
foreach ($seatRows as $row) {
  $seatNum = $row['seat_number'];
  $class = strtolower($row['class'] ?? 'regular');
  $mult = $classMultiplier[$class] ?? 1.0;
  $price = round($baseFare * $mult, 2);
  $result[] = [
    'seat_number' => $seatNum,
    'class' => $class,
    'price' => $price,
    'available' => !isset($booked[$seatNum])
  ];
}

send_json(['trip_id' => $trip_id, 'bus_id' => (int)$trip['bus_id'], 'seats' => $result]);
