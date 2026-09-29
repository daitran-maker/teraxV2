#!/bin/bash
# ============================================================
# add_tenant.sh — Auto-deploy CRC instance cho khách hàng mới
# Đặt file này tại: ~/add_tenant.sh trên VPS
# Cấp quyền: chmod +x ~/add_tenant.sh
#
# Cách dùng: ./add_tenant.sh <tên_subdomain> <port> <tunnel_token>
# Ví dụ:     ./add_tenant.sh client2 5222 eyJhIjoixxxxxx...
#
# TRƯỚC KHI DÙNG:
# 1. Vào Cloudflare Zero Trust Dashboard → Tunnels → Create Tunnel
# 2. Đặt tên tunnel = tên_subdomain (ví dụ: client2)
# 3. Public Hostname: client2.livatech.site → http://localhost:<port>
# 4. Copy Tunnel Token → điền vào field tunnel_token khi tạo subscription trên CMS
# ============================================================
set -e

# ─── CẤU HÌNH — Chỉnh sửa 1 lần ────────────────────────────
CRC_IMAGE_NAME="crc_app-app"                    # Tên Docker image đang có trên VPS
CRC_SOURCE_DIR="/opt/app/dev/crc_app"         # Thư mục chứa Dockerfile của CRC
DB_HOST="10.91.1.51"
DB_PORT="30543"
DB_USER="teraxadmin"
DB_PASSWORD="TeraX123!@#"
DB_NETWORK="crc_app_default"                    # Docker network
INIT_SQL_PATH="/opt/app/dev/crc_app/init.sql"
CMS_HMAC="${CMS_HMAC_SECRET:-cms_hmac_secret_change_me_2026}"
# ─────────────────────────────────────────────────────────────

# ─── Đọc tham số ─────────────────────────────────────────────
TENANT_ID=$1
PORT=$2
TUNNEL_TOKEN=$3

if [ -z "$TENANT_ID" ] || [ -z "$PORT" ] || [ -z "$TUNNEL_TOKEN" ]; then
  echo "❌ Thiếu tham số!"
  echo "   Dùng: ./add_tenant.sh <tên_subdomain> <port> <tunnel_token>"
  echo "   Ví dụ: ./add_tenant.sh client2 5222 eyJhIjoixxxxxx..."
  exit 1
fi

CONTAINER_NAME="crc_app_${TENANT_ID}"
TUNNEL_CONTAINER="crc_tunnel_${TENANT_ID}"
DB_NAME="crc_db_${TENANT_ID}"
JWT_SECRET="jwt_${TENANT_ID}_$(openssl rand -hex 16)"

echo ""
echo "=========================================================="
echo "  🚀 TRIỂN KHAI TENANT: ${TENANT_ID}"
echo "     Port nội bộ : ${PORT}"
echo "     Container   : ${CONTAINER_NAME}"
echo "     Database    : ${DB_NAME}"
echo "=========================================================="
echo ""

# ─── BƯỚC 1: Kiểm tra / Build image ─────────────────────────
if ! docker image inspect "$CRC_IMAGE_NAME" >/dev/null 2>&1; then
  echo "🔨 [1/5] Image chưa có. Đang build từ ${CRC_SOURCE_DIR}..."
  docker build -t "$CRC_IMAGE_NAME" "$CRC_SOURCE_DIR"
  echo "✅ Build image xong."
else
  echo "✅ [1/5] Image '${CRC_IMAGE_NAME}' đã tồn tại."
fi

# ─── BƯỚC 2: Tạo Database mới ───────────────────────────────
echo "🗄️  [2/5] Đang tạo database '${DB_NAME}'..."
PGPASSWORD="$DB_PASSWORD" docker run --rm -i postgres:16 psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -c "CREATE DATABASE \"${DB_NAME}\";" 2>/dev/null \
  && echo "   ✅ Database tạo mới." \
  || echo "   ⚠️  Database đã tồn tại, tiếp tục..."

echo "   📦 Nạp schema vào database..."
PGPASSWORD="$DB_PASSWORD" docker run --rm -i -v "$INIT_SQL_PATH:/tmp/init.sql" postgres:16 psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f /tmp/init.sql 2>/dev/null \
  || echo "   ⚠️  Schema đã được nạp, bỏ qua."
echo "✅ Database sẵn sàng."

# ─── BƯỚC 3: Chạy CRC Web App Container ────────────────────
echo "🐳 [3/5] Khởi chạy CRC container '${CONTAINER_NAME}'..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${PORT}:5221" \
  -e PORT="5221" \
  -e DATABASE_URL="postgres://${DB_USER}:TeraX123!%40%23@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e NODE_ENV="production" \
  -e CMS_HMAC_SECRET="$CMS_HMAC" \
  --network "$DB_NETWORK" \
  --restart always \
  "$CRC_IMAGE_NAME"

echo "✅ CRC app container đang chạy."

# ─── BƯỚC 4: Chạy Cloudflare Tunnel Container ───────────────
if [ "$TUNNEL_TOKEN" != "shared" ]; then
  echo "☁️  [4/5] Khởi chạy Cloudflare Tunnel '${TUNNEL_CONTAINER}'..."
  docker rm -f "$TUNNEL_CONTAINER" 2>/dev/null || true

  docker run -d \
    --name "$TUNNEL_CONTAINER" \
    --network "$DB_NETWORK" \
    -e TUNNEL_TOKEN="$TUNNEL_TOKEN" \
    --restart always \
    cloudflare/cloudflared:latest tunnel run

  echo "✅ Cloudflare Tunnel container đang chạy."
else
  echo "☁️  [4/5] Cấu hình đường hầm chung (shared). Không chạy Tunnel container riêng."
fi

# ─── BƯỚC 5: Kiểm tra containers ────────────────────────────
echo "🔍 [5/5] Kiểm tra trạng thái..."
sleep 5
docker ps | grep -E "${CONTAINER_NAME}|${TUNNEL_CONTAINER}" || true

echo ""
echo "=========================================================="
echo "🎉 TRIỂN KHAI THÀNH CÔNG!"
echo "   🐳 CRC App   : ${CONTAINER_NAME} (port ${PORT})"
echo "   ☁️  CF Tunnel : ${TUNNEL_CONTAINER}"
echo "   🗄️  Database  : ${DB_NAME}"
echo "   ⏳ CMS sẽ tự gọi init-tenant và tenant-sync trong ~45s"
echo "=========================================================="
