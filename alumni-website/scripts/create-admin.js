/**
 * create-admin.js
 * Run this ONCE to create an admin user in the database.
 *
 * Usage:
 *   node scripts/create-admin.js
 *
 * You can change the email/password below before running.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alumni-website';

// ── Admin credentials — change these if you want ──────────────────────────
const ADMIN_NAME     = 'Super Admin';
const ADMIN_EMAIL    = 'admin@alumni.com';
const ADMIN_PASSWORD = 'Admin@1234';
// ──────────────────────────────────────────────────────────────────────────

async function createAdmin() {
  console.log('\n🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected!\n');

  try {
    // Check if admin already exists
    const existing = await User.findOne({ email: ADMIN_EMAIL });

    if (existing) {
      if (existing.role !== 'admin') {
        // Promote existing user to admin
        existing.role = 'admin';
        existing.isActive = true;
        await existing.save();
        console.log(`✅ Existing user "${existing.name}" promoted to admin!`);
      } else {
        console.log(`ℹ️  Admin user already exists: ${existing.email}`);
      }
    } else {
      // Create fresh admin user
      const admin = new User({
        name:          ADMIN_NAME,
        email:         ADMIN_EMAIL,
        password:      ADMIN_PASSWORD,   // will be hashed by pre-save hook
        role:          'admin',
        isActive:      true,
        emailVerified: true,
      });
      await admin.save();
      console.log('🎉 Admin user created successfully!\n');
    }

    console.log('┌─────────────────────────────────────┐');
    console.log('│         Admin Login Details          │');
    console.log('├─────────────────────────────────────┤');
    console.log(`│  URL:      http://localhost:3000/admin-login.html`);
    console.log(`│  Email:    ${ADMIN_EMAIL.padEnd(27)}│`);
    console.log(`│  Password: ${ADMIN_PASSWORD.padEnd(27)}│`);
    console.log('└─────────────────────────────────────┘\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

createAdmin();
