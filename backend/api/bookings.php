<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

$pdo = get_pdo();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
  case 'GET':
    // List bookings for a passenger: ?passenger_id=ID
    if (!isset($_GET['passenger_id'])) send_error('Missing passenger_id', 400);
    $pid = (int)$_GET['passenger_id'];
      $stmt = $pdo->prepare("SELECT b.id, b.trip_id, b.seat_number, b.seat_class, b.fare_paid, b.payment_status, b.booking_status, b.booked_at,
                                  t.departure_datetime, t.arrival_estimated,
                                  r.id AS route_id, r.name AS route_name, r.start_point, r.end_point, r.stops_json
                           FROM bookings b
                           JOIN trips t ON b.trip_id = t.id
                           JOIN routes r ON t.route_id = r.id
                           WHERE b.passenger_id = ? ORDER BY b.booked_at DESC");
    $stmt->execute([$pid]);
    send_json($stmt->fetchAll());

  case 'POST':
    // Create booking
    $data = read_json_body();
    require_fields($data, ['passenger_id','trip_id','seat_number','fare_paid']);
    $pid = (int)$data['passenger_id'];
    $trip_id = (int)$data['trip_id'];
    $seat = sanitize_string($data['seat_number']);
    $fare = (float)$data['fare_paid'];

    // Validate passenger
    $stmt = $pdo->prepare('SELECT id FROM passengers WHERE id = ? AND status = "active"');
    $stmt->execute([$pid]);
    if (!$stmt->fetch()) send_error('Passenger invalid', 404);

    // Validate trip
    $stmt = $pdo->prepare('SELECT id, bus_id FROM trips WHERE id = ? AND status IN ("scheduled","enroute")');
    $stmt->execute([$trip_id]);
    $trip = $stmt->fetch();
    if (!$trip) send_error('Trip invalid', 404);

    // If seats table exists for bus, ensure seat exists (not strictly required)
    $seatExists = true;
    $checkSeat = $pdo->prepare('SELECT 1 FROM seats WHERE bus_id = ? AND seat_number = ? AND active = 1');
    $checkSeat->execute([$trip['bus_id'], $seat]);
    if (!$checkSeat->fetch()) { $seatExists = false; }

    // Check availability (no active booking for same seat on the trip)
    $stmt = $pdo->prepare('SELECT id FROM bookings WHERE trip_id = ? AND seat_number = ? AND booking_status = "active"');
    $stmt->execute([$trip_id, $seat]);
    if ($stmt->fetch()) send_error('Seat already booked', 409);

    $stmt = $pdo->prepare('INSERT INTO bookings (passenger_id, trip_id, seat_number, fare_paid, payment_status, booking_status) VALUES (?,?,?,?,"pending","active")');
    $stmt->execute([$pid, $trip_id, $seat, $fare]);
    send_json(['id' => $pdo->lastInsertId(), 'warning' => $seatExists ? null : 'Seat not found in seats table; created anyway'], 201);

  case 'DELETE':
    // Cancel booking: ?id=ID
    if (!isset($_GET['id'])) send_error('Missing id', 400);
    $id = (int)$_GET['id'];
    $stmt = $pdo->prepare('UPDATE bookings SET booking_status = "cancelled" WHERE id = ?');
    $stmt->execute([$id]);
    send_json(['cancelled' => true]);

  default:
    send_error('Method not allowed', 405);
}
