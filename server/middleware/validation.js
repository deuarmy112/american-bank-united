const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Registration validation rules
const registerValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('phone').optional().isMobilePhone(),
    body('dateOfBirth').optional().isDate()
];

// Login validation rules
const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
];

// Transfer validation rules
const transferValidation = [
    body('fromAccountId').notEmpty(),
    body('toAccountId').notEmpty(),
    body('amount').isFloat({ min: 0.01 })
];

module.exports = {
    validate,
    registerValidation,
    loginValidation,
    transferValidation
};
