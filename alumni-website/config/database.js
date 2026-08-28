const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alumni-website';
    
    console.log('🔌 Connecting to MongoDB...');
    console.log(`📍 Database URI: ${mongoURI.replace(/:[^:]*@/, ':****@')}`);
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Port: ${conn.connection.port}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Status: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    console.log(`   📁 Database Location: Permanent installation on localhost`);
    console.log(`   💾 Data Directory: C:\\Program Files\\MongoDB\\Server\\<version>\\data\\`);
    console.log('');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    console.error('');
    console.error('💡 Troubleshooting Steps:');
    console.error('   1. Check if MongoDB is installed:');
    console.error('      - Download from: https://www.mongodb.com/try/download/community');
    console.error('   2. Check if MongoDB service is running:');
    console.error('      - PowerShell: Get-Service MongoDB');
    console.error('      - Start service: Start-Service MongoDB');
    console.error('   3. Verify connection string in .env file:');
    console.error('      - MONGODB_URI=mongodb://localhost:27017/alumni-website');
    console.error('   4. Test connection manually:');
    console.error('      - Run: npm run check-mongodb');
    console.error('   5. Check MongoDB installation guide:');
    console.error('      - See: MONGODB_INSTALLATION.md');
    console.error('');
    console.error('💡 The server will continue but database features will not work');
    console.error('');
    
    // Don't exit process in development - allow server to run without DB
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;