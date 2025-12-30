<?php
// Load backend config/db helpers
require_once __DIR__ . '/../backend/config.php';
require_once __DIR__ . '/../backend/db.php';

header('Content-Type: application/json');
$tran = isset($_GET['tran_id']) ? trim($_GET['tran_id']) : (isset($_POST['tran_id']) ? trim($_POST['tran_id']) : null);
if (!$tran) {
    echo json_encode(['error' => 'Missing tran_id']);
    exit;
}

try {
    $pdo = get_pdo();
    $stmt = $pdo->prepare('SELECT tran_id, amount, currency, gateway, status, customer_id, shop_id, created_at FROM payments WHERE tran_id = :tran LIMIT 1');
    $stmt->execute([':tran' => $tran]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        echo json_encode(['status' => 'not_found']);
        exit;
    }
    echo json_encode(['status' => $row['status'], 'payment' => $row]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
