<?php
require_once __DIR__ . '/../backend/config.php';
require_once __DIR__ . '/../backend/db.php';

$tran = isset($_GET['tran_id']) ? trim($_GET['tran_id']) : '';
$bookingCsv = isset($_GET['booking_ids']) ? trim($_GET['booking_ids']) : '';

if ($tran === '') {
  http_response_code(400);
  echo 'Missing tran_id';
  exit;
}

function h($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

$pdo = get_pdo();

// Load payment row
$payStmt = $pdo->prepare('SELECT tran_id, amount, currency, gateway, status, created_at, raw_response FROM payments WHERE tran_id = :tran LIMIT 1');
$payStmt->execute([':tran' => $tran]);
$payment = $payStmt->fetch(PDO::FETCH_ASSOC);

// Determine booking ids
$bookingIds = [];
if ($bookingCsv !== '') {
  foreach (explode(',', $bookingCsv) as $part) {
    $id = (int)trim($part);
    if ($id > 0) $bookingIds[] = $id;
  }
}

if (!$bookingIds && $payment && !empty($payment['raw_response'])) {
  $raw = json_decode($payment['raw_response'], true);
  if (is_array($raw) && !empty($raw['booking_ids'])) {
    $csv = (string)$raw['booking_ids'];
    foreach (explode(',', $csv) as $part) {
      $id = (int)trim($part);
      if ($id > 0) $bookingIds[] = $id;
    }
  }
}

$bookingIds = array_values(array_unique($bookingIds));

$bookings = [];
$passenger = null;

if ($bookingIds) {
  $in = implode(',', array_fill(0, count($bookingIds), '?'));
  $sql = "SELECT b.id AS booking_id, b.payment_status, b.booking_status, b.booked_at, b.seat_number, b.seat_class, b.fare_paid,
                 p.id AS passenger_id, p.full_name, p.mobile, p.email,
                 t.id AS trip_id, t.departure_datetime, t.arrival_estimated,
                 r.id AS route_id, r.name AS route_name, r.start_point, r.end_point,
                 bs.id AS bus_id, bs.number AS bus_number, bs.type AS bus_type
          FROM bookings b
          JOIN passengers p ON b.passenger_id = p.id
          JOIN trips t ON b.trip_id = t.id
          JOIN routes r ON t.route_id = r.id
          JOIN buses bs ON t.bus_id = bs.id
          WHERE b.id IN ($in)
          ORDER BY b.id ASC";
  $stmt = $pdo->prepare($sql);
  $stmt->execute($bookingIds);
  $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

  if ($bookings) {
    $passenger = [
      'id' => $bookings[0]['passenger_id'],
      'full_name' => $bookings[0]['full_name'],
      'mobile' => $bookings[0]['mobile'],
      'email' => $bookings[0]['email'],
    ];
  }
}

$totalPaid = 0.0;
foreach ($bookings as $b) {
  $totalPaid += (float)$b['fare_paid'];
}

?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Payment Slip</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;margin:0;padding:20px;color:#111}
    .card{max-width:900px;margin:0 auto;background:#fff;border:1px solid #e6e7ee;border-radius:12px;padding:16px}
    .top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .title{margin:0 0 4px 0;font-size:20px}
    .muted{margin:0;color:#666;font-size:13px}
    .actions{display:flex;gap:8px;flex-wrap:wrap}
    button{padding:8px 10px;border:1px solid #cfd2dc;border-radius:10px;background:#fff;cursor:pointer}
    button.primary{background:#111;color:#fff;border-color:#111}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #ddd;padding:8px;font-size:13px;text-align:left;vertical-align:top}
    th{background:#f3f3f3}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
    .box{border:1px solid #e6e7ee;border-radius:10px;padding:10px}
    .k{color:#555;font-size:12px;margin-bottom:4px}
    .v{font-size:13px}
    @media print{
      body{background:#fff;padding:0}
      .actions{display:none}
      .card{border:none;border-radius:0}
    }
  </style>
</head>
<body>
  <div class="card" id="slipRoot">
    <div class="top">
      <div>
        <h1 class="title">Payment Slip</h1>
        <p class="muted">Bus Transport Automation</p>
      </div>
      <div class="actions">
        <button class="primary" type="button" onclick="downloadPdf()">Download PDF</button>
        <button type="button" onclick="window.print()">Print</button>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <div class="k">Transaction ID</div>
        <div class="v"><strong><?= h($tran) ?></strong></div>
      </div>
      <div class="box">
        <div class="k">Payment Status</div>
        <div class="v"><strong><?= h($payment['status'] ?? 'unknown') ?></strong></div>
      </div>
      <div class="box">
        <div class="k">Gateway</div>
        <div class="v"><?= h($payment['gateway'] ?? '—') ?></div>
      </div>
      <div class="box">
        <div class="k">Amount</div>
        <div class="v"><strong><?= h($payment ? ($payment['amount'].' '.$payment['currency']) : (number_format($totalPaid,2)." BDT")) ?></strong></div>
      </div>
    </div>

    <div class="box" style="margin-top:12px">
      <div class="k">Passenger</div>
      <div class="v">
        <?php if($passenger): ?>
          <div><strong><?= h($passenger['full_name']) ?></strong> (ID: <?= h($passenger['id']) ?>)</div>
          <div>Mobile: <?= h($passenger['mobile']) ?><?= $passenger['email'] ? ' | Email: '.h($passenger['email']) : '' ?></div>
        <?php else: ?>
          <div>—</div>
        <?php endif; ?>
      </div>
    </div>

    <h3 style="margin:14px 0 8px">Bookings</h3>

    <?php if(!$bookings): ?>
      <div class="box">No booking details found for this transaction.</div>
    <?php else: ?>
      <table>
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>Trip</th>
            <th>Route</th>
            <th>Bus</th>
            <th>Seat</th>
            <th>Fare</th>
            <th>Payment</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach($bookings as $b): ?>
            <tr>
              <td><?= h($b['booking_id']) ?></td>
              <td>
                Trip #<?= h($b['trip_id']) ?><br>
                Dep: <?= h($b['departure_datetime']) ?><br>
                Arr: <?= h($b['arrival_estimated'] ?? '—') ?>
              </td>
              <td>
                <?= h($b['route_name']) ?><br>
                <?= h($b['start_point']) ?> → <?= h($b['end_point']) ?>
              </td>
              <td>
                #<?= h($b['bus_id']) ?> - <?= h($b['bus_number']) ?><?= $b['bus_type'] ? ' ('.h($b['bus_type']).')' : '' ?>
              </td>
              <td>
                <?= h($b['seat_number']) ?><?= $b['seat_class'] ? ' ('.h($b['seat_class']).')' : '' ?>
              </td>
              <td><?= h(number_format((float)$b['fare_paid'], 2)) ?></td>
              <td><?= h($b['payment_status']) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>

      <div class="box" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:10px">
        <div>
          <div class="k">Total (from bookings)</div>
          <div class="v"><strong><?= h(number_format($totalPaid, 2)) ?></strong></div>
        </div>
        <div>
          <div class="k">Generated At</div>
          <div class="v"><?= h(date('Y-m-d H:i:s')) ?></div>
        </div>
      </div>
    <?php endif; ?>

    <p class="muted" style="margin-top:14px">Tip: you can use Print → “Save as PDF” if needed.</p>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script>
    async function downloadPdf(){
      const el = document.getElementById('slipRoot');
      if(!el) return;
      if(typeof window.html2pdf !== 'function'){
        window.print();
        return;
      }
      const file = 'payment-slip-<?= h(preg_replace('/[^A-Za-z0-9_-]/','_', $tran)) ?>.pdf';
      await window.html2pdf().set({
        margin: 10,
        filename: file,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(el).save();
    }
  </script>
</body>
</html>
