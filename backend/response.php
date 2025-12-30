<?php
require_once __DIR__ . '/config.php';

function send_json($data, int $code = 200): void {
    header('Content-Type: application/json');
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function send_error(string $message, int $code = 400, array $extra = []): void {
    send_json(array_merge(['error' => $message], $extra), $code);
}

// Basic CORS
header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
