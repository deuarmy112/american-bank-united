-- Fix Admin User
-- Run this in PgAdmin 4 Query Tool

-- First, check if admin user exists
SELECT id, email, role FROM users WHERE email = 'admin@americanbankunited.com';

-- If no results, create the admin user
-- If results show, delete and recreate with correct password hash

-- Delete existing admin if any
DELETE FROM users WHERE email = 'admin@americanbankunited.com';

-- Create new admin user with correct password hash for "Admin@123"
INSERT INTO users (id, first_name, last_name, email, password_hash, role, status, created_at)
VALUES (
    REPLACE(gen_random_uuid()::text, '-', '')::varchar(36),
    'System',
    'Administrator',
    'admin@americanbankunited.com',
    '$2b$10$XvZ3qQKZQH6YzYx7yN0JoO.Mn0vJ5LRZmFjFpKJ3HOJQ0gzQh8xJq',
    'admin',
    'active',
    CURRENT_TIMESTAMP
);

-- Verify the admin user was created
SELECT id, first_name, last_name, email, role, status FROM users WHERE email = 'admin@americanbankunited.com';
