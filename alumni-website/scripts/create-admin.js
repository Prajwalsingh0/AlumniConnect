/**
 * create-admin.js
 * Run this ONCE to create (or promote) an admin user in the database.
 *
 * Usage:
 *   node scripts/create-admin.js
 *
 * Credentials are read from environment variables so no password is
 * hardcoded in the repository. If ADMIN_PASSWORD is not provided, a
 * strong random password is generated and printed once.
 *
 * Optional .env entries:
 *   ADMIN_EMAIL=admin@alumni.com
 *   ADMIN_PASSWORD=YourStrongPasswordHere
 */

require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alumni-website';

const ADMIN_NAME = 'Super Admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@alumni.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
const generatedPassword = !process.env.ADMIN_PASSWORD;

async function createAdmin() {
  console.log('\nConnecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!\n');

  try {
    // Check if admin already exists
    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      if (existing.role !== 'admin') {
        // Promote existing user to admin
        existing.role = 'admin';
        existing.isActive = true;
        await existing.save();
        console.log(`Existing user "${existing.name}" promoted to admin!`);
      } else {
        console.log(`Admin user already exists: ${existing.email}`);
      }
    } else {
      // Create fresh admin user
      const admin = new User({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD, // will be hashed by pre-save hook
        role: 'admin',
        isActive: true,
        emailVerified: true
      });
      await admin.save();
      console.log('Admin user created successfully!');
    }

    console.log('\n========================================');
    console.log('         Admin Login Details');
    console.log('========================================');
    console.log(`  URL:      http://localhost:3000/admin-login.html`);
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    if (generatedPassword) {
      console.log('  (password was generated for this run - store it now,');
      console.log('   or set ADMIN_PASSWORD in .env before running again)');
    }
    console.log('========================================\n');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

createAdmin();
