<?php
// Load shared backend files from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../config.php';

// Simple admin wallet page - lists payments. Add authentication in production.

$pdo = get_pdo();
$q = isset($_GET['q']) ? trim($_GET['q']) : '';
$params = [];
$sql = 'SELECT id, tran_id, amount, currency, gateway, status, customer_id, shop_id, created_at FROM payments';
if ($q !== '') {
    $sql .= ' WHERE tran_id LIKE :q OR customer_id LIKE :q OR shop_id LIKE :q';
    $params[':q'] = "%$q%";
}
$sql .= ' ORDER BY created_at DESC LIMIT 200';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

?>
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Admin Wallet - Payment History</title>
    <style>
      body{font-family: Arial,Helvetica,sans-serif; padding:20px}
      table{border-collapse:collapse; width:100%}
      table th, table td{border:1px solid #ddd;padding:8px}
      table th{background:#f4f4f4}
      .status-success{color:green;font-weight:700}
      .status-initiated{color:orange}
      .status-failed{color:red}
    </style>
  </head>
  <body>
    <h2>Payment History (Wallet)</h2>
    <form method="get">
      <input type="text" name="q" value="<?= htmlspecialchars($q) ?>" placeholder="Search tran_id, customer or shop" />
      <button type="submit">Search</button>
    </form>
    <p>Showing <?= count($rows) ?> recent records.</p>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Tran ID</th>
          <th>Amount</th>
          <th>Currency</th>
          <th>Gateway</th>
          <th>Status</th>
          <th>Customer</th>
          <th>Shop</th>
          <th>Created At</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach($rows as $r): ?>
          <tr>
            <td><?= htmlspecialchars($r['id']) ?></td>
            <td><?= htmlspecialchars($r['tran_id']) ?></td>
            <td><?= htmlspecialchars($r['amount']) ?></td>
            <td><?= htmlspecialchars($r['currency']) ?></td>
            <td><?= htmlspecialchars($r['gateway']) ?></td>
            <td class="status-<?= htmlspecialchars(strtolower($r['status'])) ?>"><?= htmlspecialchars($r['status']) ?></td>
            <td><?= htmlspecialchars($r['customer_id']) ?></td>
            <td><?= htmlspecialchars($r['shop_id']) ?></td>
            <td><?= htmlspecialchars($r['created_at']) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
    <p>Note: Add authentication to restrict access to admins.</p>
    <h3>SQL to create `payments` table</h3>
    <pre>
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tran_id VARCHAR(255) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'BDT',
  gateway VARCHAR(50) DEFAULT '',
  status VARCHAR(50) DEFAULT '',
  customer_id VARCHAR(255) DEFAULT NULL,
  shop_id VARCHAR(255) DEFAULT NULL,
  raw_response TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
    </pre>
  </body>
</html>
