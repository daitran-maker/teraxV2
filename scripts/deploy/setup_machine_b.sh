#!/bin/bash
PASS="Lee@122598"

echo "=== Updating system and installing unzip/curl ==="
echo $PASS | sudo -S apt-get update
echo $PASS | sudo -S apt-get install -y unzip curl wget gnupg

echo "=== Installing Docker ==="
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    echo $PASS | sudo -S sh get-docker.sh
    echo $PASS | sudo -S usermod -aG docker $USER
    rm get-docker.sh
else
    echo "Docker is already installed."
fi

echo "=== Installing Node.js 20 and pnpm ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | echo $PASS | sudo -S -E bash -
    echo $PASS | sudo -S apt-get install -y nodejs
else
    echo "Node.js is already installed."
fi
echo $PASS | sudo -S npm install -g pnpm

echo "=== Installing Cloudflared ==="
if ! command -v cloudflared &> /dev/null; then
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    echo $PASS | sudo -S dpkg -i cloudflared.deb
    rm cloudflared.deb
else
    echo "Cloudflared is already installed."
fi

echo "=== Setting up application ==="
mkdir -p ~/crc_app
unzip -o ~/CRC_App_Docker_Ready.zip -d ~/crc_app
cd ~/crc_app

echo "=== Running Docker Compose ==="
# Sửa lại file compose một chút nếu cần, ở đây chạy trực tiếp
echo $PASS | sudo -S docker compose -f docker-compose.standalone.yml up -d --build

echo "=== DONE! ==="
