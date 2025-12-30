<?php
/**
 * Admin Password Reset Utility
 * This script helps you reset the admin password and verify the hash
 */

require_once __DIR__ . '/db.php';

// New password you want to set
$new_password = 'admin123';  // Change this to your desired password
$username = 'admin123';       // Change this to your admin username

try {
    $pdo = get_pdo();
    
    // Generate new password hash
    $password_hash = password_hash($new_password, PASSWORD_DEFAULT);
    
    echo "=== Admin Password Reset Utility ===\n\n";
    echo "Username: $username\n";
    echo "New Password: $new_password\n";
    echo "Password Hash: $password_hash\n\n";
    
    // Check if admin exists
    $stmt = $pdo->prepare('SELECT id, username, password_hash FROM admins WHERE username = ?');
    $stmt->execute([$username]);
    $admin = $stmt->fetch();
    
    if ($admin) {
        echo "Admin found in database!\n";
        echo "Current hash: " . $admin['password_hash'] . "\n\n";
        
        // Update the password
        $update_stmt = $pdo->prepare('UPDATE admins SET password_hash = ? WHERE username = ?');
        $update_stmt->execute([$password_hash, $username]);
        
        echo "✓ Password has been updated successfully!\n\n";
        
        // Verify the new password works
        if (password_verify($new_password, $password_hash)) {
            echo "✓ Password verification successful!\n";
            echo "You can now login with:\n";
            echo "  Username: $username\n";
            echo "  Password: $new_password\n";
        } else {
            echo "✗ Password verification failed!\n";
        }
    } else {
        echo "Admin not found! Creating new admin...\n\n";
        
        // Insert new admin
        $insert_stmt = $pdo->prepare('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)');
        $insert_stmt->execute([$username, $password_hash, 'super']);
        
        echo "✓ New admin created successfully!\n";
        echo "Login credentials:\n";
        echo "  Username: $username\n";
        echo "  Password: $new_password\n";
    }
    
} catch (PDOException $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
