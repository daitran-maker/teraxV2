#!/bin/bash
# ==============================================================================
# Script: deploy_tenant_app.sh
# Target Node: App + DB Node
# Description: Tự động khởi tạo CSDL với Dedicated User & Password riêng cho từng tenant,
#              cô lập bảo mật hoàn toàn, khởi tạo Super Admin và khởi chạy App container.
# ==============================================================================

set -e

export KUBECONFIG="/home/terax/.kube/config"

SUBDOMAIN="${1}"
APP_PORT="${2}"
ADMIN_USERNAME="${3}"
ADMIN_EMAIL="${4}"
ADMIN_PASSWORD="${5}"
ADMIN_NAME="${6:-Super Admin}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_ADMIN_USER="${DB_USER:-teraxadmin}"
DB_ADMIN_PASS="${DB_PASS:-TeraX123!@#}"
DB_NAME="crc_${SUBDOMAIN}_db"

# Dedicated PostgreSQL User and Password for this tenant
TENANT_DB_USER="usr_${SUBDOMAIN//[^a-zA-Z0-9_]/_}"
TENANT_DB_PASS="${TENANT_DB_PASS:-$(openssl rand -hex 12)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$SUBDOMAIN" ] || [ -z "$APP_PORT" ] || [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "❌ Error: Thiếu tham số bắt buộc!"
  echo "Usage: $0 <SUBDOMAIN> <APP_PORT> <ADMIN_USERNAME> <ADMIN_EMAIL> <ADMIN_PASSWORD> [ADMIN_NAME]"
  echo "Example: $0 tenant16 30116 admin_tenant16 owner@company.com abc123456 'Nguyễn Văn A'"
  exit 1
fi

echo "============================================================"
echo "🚀 BẮT ĐẦU KHỞI TẠO TENANT APP: ${SUBDOMAIN} (Port: ${APP_PORT})"
echo "   Database       : ${DB_NAME}"
echo "   Dedicated User : ${TENANT_DB_USER}"
echo "============================================================"

# 1. Nhận diện máy và cấu hình PostgreSQL tương ứng
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

if [[ "$HOST_IP" == *"10.91.1.100"* ]] || kubectl get deploy cms-postgres-db -n default >/dev/null 2>&1; then
  PG_DEPLOY="deploy/cms-postgres-db"
  CONTAINER_DB_HOST="10.91.1.100"
else
  PG_DEPLOY="deploy/terax-postgres-db"
  CONTAINER_DB_HOST="10.91.1.51"
fi

# 2. Tạo Dedicated DB User và Database riêng cho Tenant
echo "==> 1. Creating Dedicated DB User (${TENANT_DB_USER}) & Database (${DB_NAME}) via ${PG_DEPLOY}..."

kubectl exec -i "${PG_DEPLOY}" -- psql -U "${DB_ADMIN_USER}" -d postgres -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${TENANT_DB_USER}') THEN
    CREATE ROLE \"${TENANT_DB_USER}\" WITH LOGIN PASSWORD '${TENANT_DB_PASS}';
  ELSE
    ALTER ROLE \"${TENANT_DB_USER}\" WITH PASSWORD '${TENANT_DB_PASS}';
  END IF;
END \$\$;
"

kubectl exec -i "${PG_DEPLOY}" -- psql -U "${DB_ADMIN_USER}" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';" | grep -q 1 || \
  kubectl exec -i "${PG_DEPLOY}" -- psql -U "${DB_ADMIN_USER}" -d postgres -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${TENANT_DB_USER}\";"

# Cách ly bảo mật: Chặn public connect, chỉ cấp quyền cho chính tenant user
kubectl exec -i "${PG_DEPLOY}" -- psql -U "${DB_ADMIN_USER}" -d postgres -c "
REVOKE CONNECT ON DATABASE \"${DB_NAME}\" FROM PUBLIC;
GRANT ALL PRIVILEGES ON DATABASE \"${DB_NAME}\" TO \"${TENANT_DB_USER}\";
"

# 3. Import CSDL (Chỉ tạo bảng Schema nếu DB chưa có bảng nào)
SCHEMA_SQL_PATH="${SCRIPT_DIR}/schema_only.sql"
if [ ! -f "${SCHEMA_SQL_PATH}" ]; then
  SCHEMA_SQL_PATH="/opt/app/dev/cms_terax/scripts/schema_only.sql"
fi
if [ ! -f "${SCHEMA_SQL_PATH}" ]; then
  SCHEMA_SQL_PATH="/home/terax/schema_only.sql"
fi

TABLE_COUNT=$(kubectl exec -i "${PG_DEPLOY}" -- psql -U "${DB_ADMIN_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' \r\n' || echo "0")
if [ "${TABLE_COUNT:-0}" -lt 5 ]; then
  echo "==> 2. Importing Table Schema into fresh database ${DB_NAME}..."
  kubectl exec -i "${PG_DEPLOY}" -- psql -U "${DB_ADMIN_USER}" -d "${DB_NAME}" < "${SCHEMA_SQL_PATH}"
else
  echo "==> 2. Database ${DB_NAME} already initialized (${TABLE_COUNT} tables found). Skipping schema import."
fi

# Cấp toàn quyền trên schema public và sequences/tables cho TENANT_DB_USER
kubectl exec -i "${PG_DEPLOY}" -- psql -U "${DB_ADMIN_USER}" -d "${DB_NAME}" -c "
GRANT ALL ON SCHEMA public TO \"${TENANT_DB_USER}\";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"${TENANT_DB_USER}\";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"${TENANT_DB_USER}\";
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO \"${TENANT_DB_USER}\";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"${TENANT_DB_USER}\";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"${TENANT_DB_USER}\";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO \"${TENANT_DB_USER}\";
ALTER SCHEMA public OWNER TO \"${TENANT_DB_USER}\";
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO \"' || '${TENANT_DB_USER}' || '\"';
    END LOOP;
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequence_name) || ' OWNER TO \"' || '${TENANT_DB_USER}' || '\"';
    END LOOP;
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        EXECUTE 'ALTER VIEW public.' || quote_ident(r.table_name) || ' OWNER TO \"' || '${TENANT_DB_USER}' || '\"';
    END LOOP;
END \$\$;
"

# 4. Mã hóa Password và Khởi tạo Super Admin dựa trên thông tin CMS Sign Up
echo "==> 3. Initializing Super Admin Account (EMP-001)..."
HASHED_PASSWORD=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('${ADMIN_PASSWORD}', 10));" 2>/dev/null || node -e "console.log('${ADMIN_PASSWORD}')")

kubectl exec -i "${PG_DEPLOY}" -- psql -U "${DB_ADMIN_USER}" -d "${DB_NAME}" -c "
ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE public.employee ALTER COLUMN email DROP NOT NULL;

DELETE FROM employee WHERE email = '${ADMIN_EMAIL}';

INSERT INTO employee (employee_id, full_name, username, email, password, status, role)
VALUES (
  'EMP-001',
  '${ADMIN_NAME}',
  '${ADMIN_USERNAME}',
  '${ADMIN_EMAIL}',
  '${HASHED_PASSWORD}',
  (SELECT COALESCE((SELECT id FROM status_catalog WHERE table_name='employee' AND status_key='active' LIMIT 1), 17)),
  'Super Admin'
);
"

# 5. Khởi chạy Container / Process App
echo "==> 4. Launching Application Container on Port ${APP_PORT}..."
CONTAINER_NAME="terax-tenant-${SUBDOMAIN}"
TENANT_DIR="/opt/app/${SUBDOMAIN}"
TEMPLATE_DIR="/opt/app/terax_ver2"

# Stop & Remove container cũ nếu tồn tại
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

# Đảm bảo /opt/app/terax_ver2 luôn sẵn sàng làm template
if [ ! -d "${TEMPLATE_DIR}" ] || [ ! -f "${TEMPLATE_DIR}/server/index.js" ]; then
  echo "==> ${TEMPLATE_DIR} chưa tồn tại, đang clone teraxdev mới nhất từ GitHub..."
  rm -rf "${TEMPLATE_DIR}"
  git clone -b lee.anh git@github.com:daitran-maker/teraxdev.git "${TEMPLATE_DIR}" || git clone git@github.com:daitran-maker/teraxdev.git "${TEMPLATE_DIR}"
fi

# Tạo thư mục và copy code sạch từ template /opt/app/terax_ver2
echo "   -> Creating folder ${TENANT_DIR} and copying code from ${TEMPLATE_DIR}..."
rm -rf "${TENANT_DIR}"
mkdir -p "${TENANT_DIR}"
cp -a "${TEMPLATE_DIR}/." "${TENANT_DIR}/"
rm -rf "${TENANT_DIR}/.git" "${TENANT_DIR}/.env" "${TENANT_DIR}/node_modules" 2>/dev/null || true

CONTAINER_DB_PORT="30543"
JWT_SECRET="jwt_${SUBDOMAIN}_$(openssl rand -hex 16 2>/dev/null || echo 'default_jwt_secret_change_me')"
CMS_HMAC="${CMS_HMAC_SECRET:-cms_hmac_secret_change_me_2026}"
ENCODED_TENANT_DB_PASS=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "${TENANT_DB_PASS}" 2>/dev/null || echo "${TENANT_DB_PASS}")

# Parse and apply resource limits
LIMITS_ARGS=""
if [ -n "$LIMIT_CPU" ]; then
  if [[ "$LIMIT_CPU" =~ m$ ]]; then
    NUM=$(echo "$LIMIT_CPU" | sed 's/m//')
    DECIMAL_CPU=$(node -e "console.log(${NUM} / 1000)" 2>/dev/null || echo "0.5")
    LIMITS_ARGS="${LIMITS_ARGS} --cpus=${DECIMAL_CPU}"
  else
    LIMITS_ARGS="${LIMITS_ARGS} --cpus=${LIMIT_CPU}"
  fi
fi
if [ -n "$LIMIT_RAM" ]; then
  DOCKER_MEM=$(echo "$LIMIT_RAM" | tr '[:upper:]' '[:lower:]' | sed 's/i//')
  LIMITS_ARGS="${LIMITS_ARGS} --memory=${DOCKER_MEM}"
fi

docker run -d \
  ${LIMITS_ARGS} \
  --name "${CONTAINER_NAME}" \
  --restart always \
  -p "${APP_PORT}:3000" \
  -v "${TENANT_DIR}:/app" \
  -v "/app/node_modules" \
  -e DATABASE_URL="postgres://${TENANT_DB_USER}:${ENCODED_TENANT_DB_PASS}@${CONTAINER_DB_HOST}:${CONTAINER_DB_PORT}/${DB_NAME}" \
  -e PORT=3000 \
  -e SUBDOMAIN="${SUBDOMAIN}" \
  -e JWT_SECRET="${JWT_SECRET}" \
  -e CMS_HMAC_SECRET="${CMS_HMAC}" \
  terax-app:latest

# 6. Kiểm tra Health Check kết nối
echo "==> 5. Verifying Health Check..."
MAX_RETRY=15
COUNT=0
HEALTHY=false

while [ $COUNT -lt $MAX_RETRY ]; do
  if curl -s "http://localhost:${APP_PORT}/api/healthcheck" | grep -q "ok" || curl -s -f "http://localhost:${APP_PORT}/" > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  echo "  - Waiting for container ready (${COUNT}/${MAX_RETRY})..."
  sleep 2
  COUNT=$((COUNT + 1))
done

if [ "$HEALTHY" = true ]; then
  echo "============================================================"
  echo "✅ DEPLOY HOÀN TẤT THÀNH CÔNG!"
  echo "{\"status\": \"success\", \"subdomain\": \"${SUBDOMAIN}\", \"port\": ${APP_PORT}, \"db\": \"${DB_NAME}\", \"db_user\": \"${TENANT_DB_USER}\", \"admin_email\": \"${ADMIN_EMAIL}\"}"
  echo "============================================================"
  exit 0
else
  echo "❌ Error: App container launched on port ${APP_PORT} but healthcheck failed."
  exit 1
fi
