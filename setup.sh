#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=========================================================="
echo "          CRC App Standalone Docker Installer             "
echo "=========================================================="

# 1. Check and configure environment variables
if [ ! -f .env ]; then
    echo "⚠️ Không tìm thấy file .env. Đang tạo file .env từ template..."
    cp .env.example .env
    
    # Prompt user for Cloudflare Tunnel Token
    echo "----------------------------------------------------------"
    echo "Để cài đặt tên miền qua Cloudflare Tunnel không cần mở cổng (port forwarding),"
    echo "vui lòng nhập Cloudflare Tunnel Token."
    echo "Nếu chưa có hoặc muốn cấu hình sau, hãy nhấn Enter."
    echo "----------------------------------------------------------"
    read -p "🔑 Nhập Cloudflare Tunnel Token: " tunnel_token
    
    if [ ! -z "$tunnel_token" ]; then
        # Replace the placeholder in the .env file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/TUNNEL_TOKEN=your_cloudflare_tunnel_token_here/TUNNEL_TOKEN=$tunnel_token/g" .env
        else
            sed -i "s/TUNNEL_TOKEN=your_cloudflare_tunnel_token_here/TUNNEL_TOKEN=$tunnel_token/g" .env
        fi
        echo "✅ Đã lưu Tunnel Token vào file .env."
    else
        echo "⚠️  Bạn chưa cấu hình token. Ứng dụng vẫn chạy cục bộ nhưng không có tên miền."
    fi
else
    echo "✅ Đã phát hiện file .env sẵn có."
fi

# 2. Check if Docker is installed
if ! [ -x "$(command -v docker)" ]; then
    echo "❌ Lỗi: Docker chưa được cài đặt hoặc chưa chạy trên hệ thống này!"
    echo "Vui lòng tải và cài đặt Docker Desktop hoặc Docker Engine trước khi chạy."
    exit 1
fi

# 3. Startup Docker Compose
echo "🚀 Đang build và khởi động hệ thống qua Docker Compose..."
docker compose -f docker-compose.standalone.yml up -d --build

echo ""
echo "=========================================================="
echo "🎉 KHỞI ĐỘNG CRC APP THÀNH CÔNG!"
echo "----------------------------------------------------------"
echo "🖥️  Truy cập cục bộ tại: http://localhost:5221"
echo "🌐 Đã khởi tạo đường hầm Cloudflare để ánh xạ tên miền."
echo "📜 Quản lý Log thời gian thực tại: http://localhost:8080"
echo "=========================================================="
