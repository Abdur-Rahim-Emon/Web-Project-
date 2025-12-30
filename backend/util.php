<?php

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function require_fields(array $data, array $fields): void {
    $missing = [];
    foreach ($fields as $f) {
        if (!isset($data[$f]) || $data[$f] === '') $missing[] = $f;
    }
    if ($missing) {
        send_error('Missing fields', 422, ['missing' => $missing]);
    }
}

function sanitize_string($value): string {
    // FILTER_SANITIZE_STRING is deprecated; use a safe manual sanitizer
    if (!is_string($value)) {
        $value = (string)$value;
    }
    $value = trim($value);
    // Strip tags to avoid HTML injection
    $value = strip_tags($value);
    // Remove control characters
    $value = preg_replace('/[\x00-\x1F\x7F]/u', '', $value);
    return $value;
}
