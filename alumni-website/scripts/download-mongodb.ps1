# MongoDB Download Helper Script
# This script opens the MongoDB download page and provides installation instructions

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MongoDB Download Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📥 Opening MongoDB Download Page..." -ForegroundColor Yellow
Write-Host ""

# MongoDB Community Server Download URL
$mongodbUrl = "https://www.mongodb.com/try/download/community"

Write-Host "MongoDB Community Server Download:" -ForegroundColor Green
Write-Host "  URL: $mongodbUrl" -ForegroundColor White
Write-Host ""

# Try to open the download page in default browser
try {
    Start-Process $mongodbUrl
    Write-Host "✅ Opened MongoDB download page in your browser!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not open browser automatically." -ForegroundColor Yellow
    Write-Host "Please visit: $mongodbUrl" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Download Instructions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "On the download page, select:" -ForegroundColor Yellow
Write-Host "  • Version: Latest stable (7.0 or higher)" -ForegroundColor White
Write-Host "  • Platform: Windows" -ForegroundColor White
Write-Host "  • Package: MSI" -ForegroundColor White
Write-Host "  • Click 'Download' button" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "After downloading, run the installer and:" -ForegroundColor Yellow
Write-Host "  1. Click 'Next' on the welcome screen" -ForegroundColor White
Write-Host "  2. Accept the license agreement" -ForegroundColor White
Write-Host "  3. Choose 'Complete' installation type" -ForegroundColor White
Write-Host "  4. ⚠️  IMPORTANT: Check 'Install MongoDB as a Service'" -ForegroundColor Green
Write-Host "  5. Select 'Run service as Network Service user'" -ForegroundColor White
Write-Host "  6. Service Name: MongoDB (default)" -ForegroundColor White
Write-Host "  7. Check 'Install MongoDB Compass' (optional but recommended)" -ForegroundColor White
Write-Host "  8. Click 'Install' and wait for completion" -ForegroundColor White
Write-Host "  9. Click 'Finish'" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "After Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Verify MongoDB service is running:" -ForegroundColor Yellow
Write-Host "   Get-Service MongoDB" -ForegroundColor White
Write-Host ""

Write-Host "2. If service is not running, start it (as Administrator):" -ForegroundColor Yellow
Write-Host "   Start-Service MongoDB" -ForegroundColor White
Write-Host ""

Write-Host "3. Run the setup script:" -ForegroundColor Yellow
Write-Host "   .\scripts\setup-mongodb.ps1" -ForegroundColor White
Write-Host ""

Write-Host "4. Test the connection:" -ForegroundColor Yellow
Write-Host "   npm run check-mongodb" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Alternative: Direct Download Links" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "MongoDB 7.0 (Latest Stable):" -ForegroundColor Green
Write-Host "  Windows 64-bit MSI: https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14-signed.msi" -ForegroundColor White
Write-Host ""

Write-Host "MongoDB 6.0 (LTS):" -ForegroundColor Green
Write-Host "  Windows 64-bit MSI: https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-6.0.19-signed.msi" -ForegroundColor White
Write-Host ""

Write-Host "Note: Version numbers may change. Visit the official page for latest version." -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Need Help?" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📚 Detailed Installation Guide: MONGODB_INSTALLATION.md" -ForegroundColor Cyan
Write-Host "🚀 Quick Setup Guide: QUICK_SETUP.md" -ForegroundColor Cyan
Write-Host ""

Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

