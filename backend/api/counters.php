<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

$pdo = get_pdo();
$method = $_SERVER['REQUEST_METHOD'];

function ensure_counters_table(PDO $pdo): void {
  static $ensured = false;
  if ($ensured) {
    return;
  }
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS bus_counters (
      counter_id INT AUTO_INCREMENT PRIMARY KEY,
      counter_name VARCHAR(100) NOT NULL,
      location_address VARCHAR(255) NOT NULL,
      district VARCHAR(100) NOT NULL,
      contact_number VARCHAR(20) NOT NULL,
      alternate_contact VARCHAR(20) NULL,
      email VARCHAR(100) NULL,
      opening_time TIME NULL,
      closing_time TIME NULL,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  $ensured = true;
}

ensure_counters_table($pdo);

function seed_counters_if_empty(PDO $pdo): void {
  static $checked = false;
  if ($checked) {
    return;
  }
  $count = (int)$pdo->query('SELECT COUNT(*) FROM bus_counters')->fetchColumn();
  if ($count === 0) {
    $seed = $pdo->prepare(
      'INSERT INTO bus_counters (counter_name, location_address, district, contact_number, alternate_contact, email, opening_time, closing_time, status) VALUES
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?),
      (?,?,?,?,?,?,?,?,?)'
    );
    $seed->execute([
      'Gabtoli Bus Counter', 'Gabtoli Bus Terminal, Mirpur, Dhaka', 'Dhaka', '01711000001', '01822000001', 'gabtoli@counterbd.com', '06:00:00', '23:00:00', 'active',
      'Mohakhali Bus Counter', 'Mohakhali Intercity Bus Terminal, Dhaka', 'Dhaka', '01711000002', null, 'mohakhali@counterbd.com', '06:00:00', '22:00:00', 'active',
      'Sayedabad Bus Counter', 'Sayedabad Bus Terminal, Jatrabari, Dhaka', 'Dhaka', '01711000003', null, 'sayedabad@counterbd.com', '05:30:00', '23:30:00', 'active'
    ]);
  }
  $checked = true;
}

seed_counters_if_empty($pdo);

function sanitize_optional_string($value): ?string {
  if ($value === null) {
    return null;
  }
  $sanitized = sanitize_string($value);
  return $sanitized === '' ? null : $sanitized;
}

try {
  switch ($method) {
    case 'GET':
      // Optional filters: district, status
      $where = [];
      $params = [];
      if (isset($_GET['district']) && $_GET['district'] !== '') {
        $where[] = 'district = ?';
        $params[] = sanitize_string($_GET['district']);
      }
      if (isset($_GET['status']) && $_GET['status'] !== '') {
        $where[] = 'status = ?';
        $params[] = sanitize_string($_GET['status']);
      }
      $sql = 'SELECT counter_id, counter_name, location_address, district, contact_number, alternate_contact, email, opening_time, closing_time, status FROM bus_counters';
      if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
      }
      $sql .= ' ORDER BY district, counter_name';
      $stmt = $pdo->prepare($sql);
      $stmt->execute($params);
      send_json($stmt->fetchAll());
      break;
    case 'POST':
      // Basic create (for admin tools; not exposed in passenger UI)
      $data = read_json_body();
      require_fields($data, ['counter_name','location_address','district','contact_number']);
      $stmt = $pdo->prepare('INSERT INTO bus_counters (counter_name, location_address, district, contact_number, alternate_contact, email, opening_time, closing_time, status) VALUES (?,?,?,?,?,?,?,?,?)');
      $stmt->execute([
        sanitize_string($data['counter_name']),
        sanitize_string($data['location_address']),
        sanitize_string($data['district']),
        sanitize_string($data['contact_number']),
        isset($data['alternate_contact']) ? sanitize_optional_string($data['alternate_contact']) : null,
        isset($data['email']) ? sanitize_optional_string($data['email']) : null,
        isset($data['opening_time']) && $data['opening_time'] !== '' ? $data['opening_time'] : null,
        isset($data['closing_time']) && $data['closing_time'] !== '' ? $data['closing_time'] : null,
        isset($data['status']) ? sanitize_string($data['status']) : 'active'
      ]);
      send_json(['id' => $pdo->lastInsertId()], 201);
      break;
    case 'PUT':
      if (!isset($_GET['id'])) send_error('Missing id', 400);
      $id = (int)$_GET['id'];
      $data = read_json_body();
      require_fields($data, ['counter_name','location_address','district','contact_number']);
      $check = $pdo->prepare('SELECT 1 FROM bus_counters WHERE counter_id = ?');
      $check->execute([$id]);
      if (!$check->fetchColumn()) {
        send_error('Counter not found', 404);
      }
      $stmt = $pdo->prepare('UPDATE bus_counters SET counter_name=?, location_address=?, district=?, contact_number=?, alternate_contact=?, email=?, opening_time=?, closing_time=?, status=? WHERE counter_id=?');
      $stmt->execute([
        sanitize_string($data['counter_name']),
        sanitize_string($data['location_address']),
        sanitize_string($data['district']),
        sanitize_string($data['contact_number']),
        isset($data['alternate_contact']) ? sanitize_optional_string($data['alternate_contact']) : null,
        isset($data['email']) ? sanitize_optional_string($data['email']) : null,
        isset($data['opening_time']) && $data['opening_time'] !== '' ? $data['opening_time'] : null,
        isset($data['closing_time']) && $data['closing_time'] !== '' ? $data['closing_time'] : null,
        isset($data['status']) ? sanitize_string($data['status']) : 'active',
        $id
      ]);
      send_json(['updated' => true]);
      break;
    case 'DELETE':
      if (!isset($_GET['id'])) send_error('Missing id', 400);
      $id = (int)$_GET['id'];
      $stmt = $pdo->prepare('DELETE FROM bus_counters WHERE counter_id = ?');
      $stmt->execute([$id]);
      if ($stmt->rowCount() === 0) {
        send_error('Counter not found', 404);
      }
      send_json(['deleted' => true]);
      break;
    default:
      send_error('Method not allowed', 405);
  }
} catch (Throwable $e) {
  send_error('Server error', 500, ['detail' => $e->getMessage()]);
}
