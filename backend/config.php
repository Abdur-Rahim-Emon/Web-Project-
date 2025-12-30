<?php
// Configuration values (edit for deployment)
const DB_HOST = '127.0.0.1';
const DB_NAME = 'bus_transport';
const DB_USER = 'root'; // change if not root
const DB_PASS = '';     // set your password
const DB_CHARSET = 'utf8mb4';

// CORS origin allow (adjust for production)
const CORS_ORIGIN = '*';


// SSLCommerz configuration - set these to your credentials
// Use sandbox credentials for testing and change `SSL_SANDBOX` to false for production.
const SSL_STORE_ID = 'trime68e81f8f7f99f';
const SSL_STORE_PASS = 'trime68e81f8f7f99f@ssl';
const SSL_SANDBOX = true; // true = sandbox endpoint, false = production