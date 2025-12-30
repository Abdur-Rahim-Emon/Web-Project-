<?php
// Load shared backend utilities from parent directory
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../util.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    try {
        $data = read_json_body();
        require_fields($data, ['username', 'password']);
        
        $username = sanitize_string($data['username']);
        $password = $data['password'];
        
        $pdo = get_pdo();
        $stmt = $pdo->prepare('SELECT id, username, password_hash FROM admins WHERE username = ?');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        
        if (!$row) {
            // Log for debugging (remove in production)
            error_log("Admin login failed: Username '$username' not found");
            send_error('Invalid credentials', 401);
        }
        
        if (!password_verify($password, $row['password_hash'])) {
            // Log for debugging (remove in production)
            error_log("Admin login failed: Invalid password for username '$username'");
            send_error('Invalid credentials', 401);
        }
        
        // For demo: return a simple token (do NOT use in production)
        $token = base64_encode($row['id'] . ':' . sha1($row['username'] . microtime(true)));
        send_json(['token' => $token, 'username' => $row['username']]);
    } catch (PDOException $e) {
        error_log("Admin login database error: " . $e->getMessage());
        send_error('Database error', 500);
    } catch (Exception $e) {
        error_log("Admin login error: " . $e->getMessage());
        send_error('Server error', 500);
    }
}
send_error('Method not allowed', 405);
