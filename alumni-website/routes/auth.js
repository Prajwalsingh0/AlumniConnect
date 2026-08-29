const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../services/emailService');
const router = express.Router();

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Validation middleware
const validateRegistration = [
  // Accept either 'name' OR 'firstName' and 'lastName'
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').exists().withMessage('Password is required')
];

// Register new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);

    // Custom validation: require either 'name' OR both 'firstName' and 'lastName'
    const { name, firstName, lastName } = req.body;
    if (!name && (!firstName || !lastName)) {
      return res.status(400).json({
        errors: [
          ...errors.array(),
          {
            msg: 'Either provide a full name or both first name and last name',
            param: 'name'
          }
        ]
      });
    }

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, ...otherFields } = req.body;

    // Handle both name format and firstName/lastName format
    const fullName = name || (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName || lastName || 'User');

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Create new user with profile data
    const newUser = new User({
      name: fullName,
      email,
      password,
      profile: {
        title: otherFields.currentPosition || '',
        company: otherFields.company || '',
        location: otherFields.location || '',
        phone: otherFields.phone || '',
        graduationYear: otherFields.graduationYear || null,
        department: otherFields.major || '',
        degree: otherFields.degree || '',
        linkedin: otherFields.linkedin || ''
      }
    });

    // Generate verification token
    const verificationToken = generateVerificationToken();
    newUser.emailVerificationToken = verificationToken;
    newUser.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await newUser.save();

    // Send verification email (best effort - registration still succeeds if SMTP is not configured)
    try {
      await sendVerificationEmail(newUser.email, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError.message);
    }

    // Log the user in immediately (both frontend flows expect token + user after registration)
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      token,
      user: newUser.getPublicProfile()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond the same way so attackers cannot discover which emails are registered
    const genericResponse = { message: 'If that email is registered, a password reset link has been sent.' };

    if (!user) {
      return res.json(genericResponse);
    }

    // Generate reset token
    const resetToken = generateVerificationToken();
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    // Send reset email
    await sendPasswordResetEmail(user.email, resetToken);

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error.message);
    res.json({ message: 'If that email is registered, a password reset link has been sent.' });
  }
});

// Reset password
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findOne({
      passwordResetToken: req.params.token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Set new password (it will be hashed by the pre-save hook)
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRE }
    );

    // Get user data without password
    const userResponse = user.getPublicProfile();

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Logout user
router.post('/logout', authenticateToken, (req, res) => {
  try {
    // In a stateless JWT setup, logout is handled client-side
    // The client should remove the token from storage
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Find user by ID from JWT token
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user data without password
    const userResponse = user.getPublicProfile();

    res.json({
      message: 'User profile retrieved successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
});

module.exports = router;