# Powershell Setup Script for CRC App Standalone
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "          CRC App Standalone Docker Installer (Windows)   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check and configure environment variables
if (-not (Test-Path ".env")) {
    Write-Host "⚠️ Không tìm thấy file .env. Đang tạo file .env từ template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    
    Write-Host "----------------------------------------------------------"
    Write-Host "Để cài đặt tên miền qua Cloudflare Tunnel không cần mở cổng (port forwarding),"
    Write-Host "vui lòng nhập Cloudflare Tunnel Token."
    Write-Host "Nếu chưa có hoặc muốn cấu hình sau, hãy nhấn Enter."
    Write-Host "----------------------------------------------------------"
    
    $tunnel_token = Read-Host "🔑 Nhập Cloudflare Tunnel Token"
    
    if (-not [string]::IsNullOrEmpty($tunnel_token)) {
        $env_content = Get-Content ".env"
        $env_content = $env_content -replace "TUNNEL_TOKEN=your_cloudflare_tunnel_token_here", "TUNNEL_TOKEN=$tunnel_token"
        Set-Content ".env" $env_content
        Write-Host "✅ Đã lưu Tunnel Token vào file .env." -ForegroundColor Green
    } else {
        Write-Host "⚠️ Bạn chưa cấu hình token. Ứng dụng vẫn chạy cục bộ nhưng không có tên miền." -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Đã phát hiện file .env sẵn có." -ForegroundColor Green
}

# 2. Check if Docker is installed
try {
    $dockerCheck = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCheck) {
        Write-Host "❌ Lỗi: docker command không khả dụng. Vui lòng cài đặt và chạy Docker Desktop." -ForegroundColor Red
        Exit 1
    }
} catch {
    Write-Host "❌ Lỗi: Không thể tìm thấy Docker trên hệ thống." -ForegroundColor Red
    Exit 1
}

# 3. Startup Docker Compose
Write-Host "🚀 Đang build và khởi động hệ thống qua Docker Compose..." -ForegroundColor Green
docker compose -f docker-compose.standalone.yml up -d --build

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "🎉 KHỞI ĐỘNG CRC APP THÀNH CÔNG!" -ForegroundColor Green
Write-Host "----------------------------------------------------------" -ForegroundColor Green
Write-Host "🖥️  Truy cập cục bộ tại: http://localhost:5221" -ForegroundColor Yellow
Write-Host "🌐 Đã khởi tạo đường hầm Cloudflare để ánh xạ tên miền." -ForegroundColor Yellow
Write-Host "📜 Quản lý Log thời gian thực tại: http://localhost:8080" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
