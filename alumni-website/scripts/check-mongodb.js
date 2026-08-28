/**
 * MongoDB Connection Checker
 * Verifies MongoDB installation and connection
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function checkMongoDB() {
  console.log('🔍 Checking MongoDB Connection...\n');
  
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alumni-website';
  console.log(`📡 Connection String: ${mongoURI.replace(/:[^:]*@/, ':****@')}\n`);

  try {
    // Attempt connection
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
    });

    console.log('✅ MongoDB Connection Successful!');
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Port: ${conn.connection.port}`);
    console.log(`   State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}\n`);

    // List databases
    const adminDb = conn.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    
    console.log('📊 Available Databases:');
    databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Check if alumni-website database exists
    const dbExists = databases.some(db => db.name === 'alumni-website');
    if (dbExists) {
      console.log('\n✅ alumni-website database found!');
      
      // List collections
      const collections = await conn.connection.db.listCollections().toArray();
      if (collections.length > 0) {
        console.log('\n📁 Collections:');
        collections.forEach(col => {
          console.log(`   - ${col.name}`);
        });
      } else {
        console.log('\n📁 No collections found (database is empty)');
      }
    } else {
      console.log('\nℹ️  alumni-website database will be created on first use');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Connection check completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ MongoDB Connection Failed!');
    console.error(`   Error: ${error.message}\n`);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Troubleshooting Steps:');
      console.log('   1. Check if MongoDB service is running:');
      console.log('      Get-Service MongoDB');
      console.log('   2. Start MongoDB service:');
      console.log('      Start-Service MongoDB');
      console.log('   3. Verify MongoDB is installed:');
      console.log('      mongosh --version');
    } else if (error.message.includes('timeout')) {
      console.log('💡 Troubleshooting Steps:');
      console.log('   1. Check if MongoDB is accessible:');
      console.log('      mongosh mongodb://localhost:27017');
      console.log('   2. Verify MongoDB service is running');
      console.log('   3. Check firewall settings');
    } else {
      console.log('💡 Troubleshooting Steps:');
      console.log('   1. Verify MONGODB_URI in .env file');
      console.log('   2. Check MongoDB installation');
      console.log('   3. Review MongoDB logs for errors');
    }
    
    process.exit(1);
  }
}

// Run check
checkMongoDB();

