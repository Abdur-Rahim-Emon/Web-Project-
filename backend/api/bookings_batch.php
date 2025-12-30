<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  send_error('Method not allowed', 405);
}

$data = read_json_body();
require_fields($data, ['passenger_id','trip_id','seats']);
if (!is_array($data['seats']) || count($data['seats']) === 0) {
  send_error('No seats provided', 422);
}

$pdo = get_pdo();
$pid = (int)$data['passenger_id'];
$tripId = (int)$data['trip_id'];
$seatItems = $data['seats']; // each: { seat_number, price }

// Validate passenger
$stmt = $pdo->prepare('SELECT id,status FROM passengers WHERE id = ?');
$stmt->execute([$pid]);
$passenger = $stmt->fetch();
if (!$passenger || $passenger['status'] !== 'active') {
  send_error('Invalid passenger', 403);
}

// Validate trip
$stmt = $pdo->prepare('SELECT id,status FROM trips WHERE id = ?');
$stmt->execute([$tripId]);
$trip = $stmt->fetch();
if (!$trip || !in_array($trip['status'], ['scheduled','enroute'], true)) {
  send_error('Invalid or closed trip', 409);
}

// Fetch already booked seats (active)
$stmt = $pdo->prepare("SELECT seat_number FROM bookings WHERE trip_id = ? AND booking_status = 'active'");
$stmt->execute([$tripId]);
$booked = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));

// Check duplicates and conflicts
$requested = [];
foreach ($seatItems as $s) {
  if (!isset($s['seat_number'])) send_error('seat_number missing in seats array', 422);
          $sn = sanitize_string($s['seat_number']);
          if (isset($requested[$sn])) send_error('Duplicate seat in request: ' . $sn, 422);
          if (isset($booked[$sn])) send_error('Seat already booked: ' . $sn, 409);
          $seatClass = isset($s['seat_class']) ? sanitize_string($s['seat_class']) : 'regular';
          $fare = (float)($s['price'] ?? 0);
          $requested[$sn] = ['fare'=>$fare,'seat_class'=>$seatClass];
}

try {
  $pdo->beginTransaction();
          $insert = $pdo->prepare('INSERT INTO bookings (passenger_id, trip_id, seat_number, seat_class, fare_paid, payment_status, booking_status) VALUES (?,?,?,?,?,"pending","active")');
          $bookingIds = [];
          foreach ($requested as $seatNum => $seatData) {
            $insert->execute([$pid, $tripId, $seatNum, $seatData['seat_class'], $seatData['fare']]);
            $bookingIds[] = (int)$pdo->lastInsertId();
  }
  $pdo->commit();
          $responseSeats = [];
          foreach ($requested as $seatNum => $seatData) {
            $responseSeats[] = [
              'seat_number' => $seatNum,
              'seat_class' => $seatData['seat_class'],
              'fare_paid' => $seatData['fare']
            ];
          }
          send_json(['booked' => $responseSeats, 'count' => count($requested), 'booking_ids' => $bookingIds], 201);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  send_error('Booking failed', 500, ['details' => $e->getMessage()]);
}
