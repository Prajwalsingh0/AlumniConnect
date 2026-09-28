const nodemailer = require('nodemailer');
const crypto = require('crypto');

let transporter = null;

/**
 * Create the SMTP transporter on first use so the app can start
 * (and register users) even when email is not configured.
 */
const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email service is not configured (set EMAIL_USER and EMAIL_PASSWORD)');
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: parseInt(process.env.EMAIL_PORT, 10) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  return transporter;
};

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
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

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

  await getTransporter().sendMail(mailOptions);
};

/**
 * Send password reset email
 * @param {string} email - User's email
 * @param {string} token - Reset token
 */
const sendPasswordResetEmail = async (email, token) => {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

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

  await getTransporter().sendMail(mailOptions);
};

/**
 * Whether SMTP details are present. Callers use this to skip work quietly
 * instead of catching a configuration error per recipient.
 */
const isEmailConfigured = () => !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

const escapeHtml = (value) => String(value === null || value === undefined ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

/**
 * Send the periodic activity digest.
 * @param {string} email - recipient
 * @param {string} name - recipient's display name
 * @param {object} digest - output of buildDigest
 * @param {object} options - { now }
 */
const sendDigestEmail = async (email, name, digest, { now = new Date() } = {}) => {
  const lines = [];

  if (digest.unreadMessages > 0) lines.push(`${digest.unreadMessages} unread message${digest.unreadMessages === 1 ? '' : 's'}`);
  if (digest.unreadNotifications > 0) lines.push(`${digest.unreadNotifications} new notification${digest.unreadNotifications === 1 ? '' : 's'}`);
  if (digest.pendingMentorshipRequests > 0) lines.push(`${digest.pendingMentorshipRequests} mentorship request${digest.pendingMentorshipRequests === 1 ? '' : 's'} waiting for you`);
  if (digest.newReviews > 0) lines.push(`${digest.newReviews} new review${digest.newReviews === 1 ? '' : 's'}`);
  if (digest.newJobs > 0) lines.push(`${digest.newJobs} new job posting${digest.newJobs === 1 ? '' : 's'}`);
  if (digest.groupPosts > 0) lines.push(`${digest.groupPosts} new group post${digest.groupPosts === 1 ? '' : 's'}`);

  const eventLines = (digest.upcomingEvents || [])
    .map((event) => `<li>${escapeHtml(event.title)} - ${escapeHtml(new Date(event.date).toLocaleString('en-IN'))}${event.isVirtual ? ' (online)' : ''}</li>`)
    .join('');

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your alumni network digest',
    html: `
      <h1>Your alumni digest</h1>
      <p>Hello ${escapeHtml(name || 'there')}, here is what happened since ${escapeHtml(digest.since.toLocaleDateString('en-IN'))}.</p>
      ${lines.length ? `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>` : '<p>No new activity.</p>'}
      ${eventLines ? `<h2>Coming up</h2><ul>${eventLines}</ul>` : ''}
      <p><a href="${baseUrl}/portal.html">Open the alumni portal</a></p>
      <p style="color:#6b7280;font-size:12px">You can turn this digest off in your notification settings.</p>
    `
  };

  await getTransporter().sendMail(mailOptions);
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendDigestEmail,
  isEmailConfigured
};
