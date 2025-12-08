const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { registerValidation, loginValidation, validate } = require('../middleware/validation');
const { generateId } = require('../utils/helpers');

const router = express.Router();

// Register new user
router.post('/register', registerValidation, validate, async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, dateOfBirth } = req.body;

        // Check if user already exists
        const existingUsers = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUsers.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

        // Create user
        const userId = generateId();
        await pool.query(
            `INSERT INTO users (id, first_name, last_name, email, phone, date_of_birth, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, firstName, lastName, email, phone || null, dateOfBirth || null, passwordHash]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId, email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: userId,
                email,
                firstName,
                lastName
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
router.post('/login', loginValidation, validate, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const users = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (users.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = users.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user profile
router.get('/profile', require('../middleware/auth').authenticateToken, async (req, res) => {
    try {
        const users = await pool.query(
            'SELECT id, first_name, last_name, email, phone, date_of_birth, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (users.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users.rows[0]);

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

module.exports = router;
