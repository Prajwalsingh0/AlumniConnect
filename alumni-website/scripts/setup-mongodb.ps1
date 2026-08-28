# MongoDB Setup Script for Windows
# This script helps set up MongoDB as a permanent database service

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MongoDB Permanent Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if MongoDB is installed
Write-Host "Checking MongoDB installation..." -ForegroundColor Yellow
$mongodPath = Get-Command mongod -ErrorAction SilentlyContinue
$mongoshPath = Get-Command mongosh -ErrorAction SilentlyContinue

if (-not $mongodPath -and -not $mongoshPath) {
    Write-Host "❌ MongoDB is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install MongoDB Community Server:" -ForegroundColor Yellow
    Write-Host "1. Visit: https://www.mongodb.com/try/download/community" -ForegroundColor White
    Write-Host "2. Download MongoDB Community Server for Windows" -ForegroundColor White
    Write-Host "3. Run the installer and select 'Install MongoDB as a Service'" -ForegroundColor White
    Write-Host "4. Run this script again after installation" -ForegroundColor White
    Write-Host ""
    Write-Host "For detailed instructions, see: MONGODB_INSTALLATION.md" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ MongoDB is installed!" -ForegroundColor Green
Write-Host ""

# Check MongoDB service status
Write-Host "Checking MongoDB service status..." -ForegroundColor Yellow
$service = Get-Service MongoDB -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -eq 'Running') {
        Write-Host "✅ MongoDB service is running!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  MongoDB service is stopped. Starting service..." -ForegroundColor Yellow
        try {
            Start-Service MongoDB
            Write-Host "✅ MongoDB service started successfully!" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed to start MongoDB service!" -ForegroundColor Red
            Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
            exit 1
        }
    }
} else {
    Write-Host "⚠️  MongoDB service not found. MongoDB may not be installed as a service." -ForegroundColor Yellow
    Write-Host "Please install MongoDB with 'Install as a Service' option." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Test MongoDB connection
Write-Host "Testing MongoDB connection..." -ForegroundColor Yellow
try {
    $result = mongosh --eval "db.version()" --quiet 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MongoDB connection successful!" -ForegroundColor Green
        Write-Host "   MongoDB Version: $result" -ForegroundColor White
    } else {
        Write-Host "❌ MongoDB connection failed!" -ForegroundColor Red
        Write-Host "Please check MongoDB service status." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "⚠️  Could not test MongoDB connection directly." -ForegroundColor Yellow
    Write-Host "Please verify MongoDB is running manually." -ForegroundColor Yellow
}

Write-Host ""

# Check if .env file exists
Write-Host "Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ .env file exists!" -ForegroundColor Green
    
    # Check if MONGODB_URI is set
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "MONGODB_URI") {
        Write-Host "✅ MONGODB_URI is configured in .env file!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  MONGODB_URI not found in .env file." -ForegroundColor Yellow
        Write-Host "Adding MONGODB_URI to .env file..." -ForegroundColor Yellow
        Add-Content -Path ".env" -Value "`nMONGODB_URI=mongodb://localhost:27017/alumni-website"
        Write-Host "✅ MONGODB_URI added to .env file!" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  .env file not found. Creating .env file..." -ForegroundColor Yellow
    @"
# MongoDB Configuration (Permanent Database)
MONGODB_URI=mongodb://localhost:27017/alumni-website

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
"@ | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "✅ .env file created!" -ForegroundColor Green
    Write-Host "⚠️  Please update JWT_SECRET in .env file for security!" -ForegroundColor Yellow
}

Write-Host ""

# Test Node.js connection
Write-Host "Testing Node.js MongoDB connection..." -ForegroundColor Yellow
if (Test-Path "scripts/check-mongodb.js") {
    try {
        node scripts/check-mongodb.js
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ All checks passed!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Connection test failed!" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "⚠️  Could not run connection test." -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  check-mongodb.js script not found." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Start your application: npm start" -ForegroundColor White
Write-Host "2. Verify connection in server logs" -ForegroundColor White
Write-Host "3. Initialize database (optional): npm run seed" -ForegroundColor White
Write-Host ""
Write-Host "MongoDB Service Commands:" -ForegroundColor Yellow
Write-Host "  Start:   Start-Service MongoDB" -ForegroundColor White
Write-Host "  Stop:    Stop-Service MongoDB" -ForegroundColor White
Write-Host "  Status:  Get-Service MongoDB" -ForegroundColor White
Write-Host "  Restart: Restart-Service MongoDB" -ForegroundColor White
Write-Host ""
Write-Host "Database Location:" -ForegroundColor Yellow
Write-Host "  C:\Program Files\MongoDB\Server\<version>\data\" -ForegroundColor White
Write-Host ""

