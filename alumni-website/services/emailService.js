const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // or use SendGrid, AWS SES
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Generate a random long-lived verification token
 * @returns {string} 64-character hex string
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send verification email to user
 * @param {string} email - User's email
 * @param {string} token - Verification token
 */
const sendVerificationEmail = async (email, token) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Alumni Account',
    html: `
      <h1>Welcome to Alumni Network!</h1>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verificationLink}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `
  };
  
  await transporter.sendMail(mailOptions);
};

/**
 * Send password reset email
 * @param {string} email - User's email
 * @param {string} token - Reset token
 */
const sendPasswordResetEmail = async (email, token) => {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
  };

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail
};
