#!/bin/bash
# ============================================================
# add_tenant.sh — Auto-deploy/manage CRC instances in Kubernetes (K8s)
# Tự động khởi tạo Dedicated Database User & Password riêng biệt cho từng tenant.
# Cấp quyền: chmod +x ~/add_tenant.sh
# ============================================================
set -e

# Load Kubeconfig to make sure kubectl works
export KUBECONFIG="/home/terax/.kube/config"

# ─── CẤU HÌNH ──────────────────────────────────────────────
CRC_IMAGE_NAME="crc-web-app:latest"                  # Tên K8s Docker image
INIT_SQL_PATH="/opt/app/dev/cms_terax/scripts/schema_only.sql"
if [ ! -f "$INIT_SQL_PATH" ]; then
  INIT_SQL_PATH="/opt/app/terax_ver2/scripts/schema_only.sql"
fi
if [ ! -f "$INIT_SQL_PATH" ]; then
  INIT_SQL_PATH="/home/terax/schema_only.sql"
fi
CMS_HMAC="${CMS_HMAC_SECRET:-cms_hmac_secret_change_me_2026}"
DB_POD_DEPLOYMENT="terax-postgres-db"
# ─────────────────────────────────────────────────────────────

ACTION="deploy"
if [ "$1" = "suspend" ] || [ "$1" = "unsuspend" ] || [ "$1" = "delete" ]; then
  ACTION="$1"
  TENANT_ID="$2"
else
  TENANT_ID="$1"
  PORT="$2"
  TUNNEL_TOKEN="$3"
fi

if [ -z "$TENANT_ID" ]; then
  echo "❌ Thiếu tên tenant!"
  echo "   Dùng: ./add_tenant.sh <tên_subdomain> <port> <tunnel_token> (để deploy)"
  echo "         ./add_tenant.sh suspend <tên_subdomain>"
  echo "         ./add_tenant.sh unsuspend <tên_subdomain>"
  echo "         ./add_tenant.sh delete <tên_subdomain>"
  exit 1
fi

DEPLOYMENT_NAME="crc-deployment-${TENANT_ID}"
SERVICE_NAME="crc-service-${TENANT_ID}"
TUNNEL_DEPLOYMENT_NAME="crc-tunnel-deployment-${TENANT_ID}"
SECRET_NAME="crc-env-${TENANT_ID}"
DB_NAME="crc_${TENANT_ID}_db"
JWT_SECRET="jwt_${TENANT_ID}_$(openssl rand -hex 16)"

# Dedicated PostgreSQL User and Password for this tenant
TENANT_DB_USER="usr_${TENANT_ID//[^a-zA-Z0-9_]/_}"
TENANT_DB_PASS="${TENANT_DB_PASS:-$(openssl rand -hex 12)}"

case "$ACTION" in
  "deploy")
    if [ -z "$PORT" ] || [ -z "$TUNNEL_TOKEN" ]; then
      echo "❌ Thiếu tham số port hoặc tunnel_token cho action deploy!"
      exit 1
    fi

    echo ""
    echo "=========================================================="
    echo "  🚀 KUBERNETES DEPLOY TENANT: ${TENANT_ID}"
    echo "     Port nội bộ    : ${PORT}"
    echo "     Deployment     : ${DEPLOYMENT_NAME}"
    echo "     Database       : ${DB_NAME}"
    echo "     Dedicated User : ${TENANT_DB_USER}"
    echo "=========================================================="
    echo ""

    # 1. Tạo Dedicated DB User & Database mới qua kubectl exec
    echo "🗄️  [1/4] Đang tạo Dedicated User '${TENANT_DB_USER}' và Database '${DB_NAME}'..."
    kubectl exec -i deployment/${DB_POD_DEPLOYMENT} -- psql -U teraxadmin -d postgres -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${TENANT_DB_USER}') THEN
    CREATE ROLE \"${TENANT_DB_USER}\" WITH LOGIN PASSWORD '${TENANT_DB_PASS}';
  ELSE
    ALTER ROLE \"${TENANT_DB_USER}\" WITH PASSWORD '${TENANT_DB_PASS}';
  END IF;
END \$\$;
"

    kubectl exec -i deployment/${DB_POD_DEPLOYMENT} -- psql -U teraxadmin -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';" | grep -q 1 || \
      kubectl exec -i deployment/${DB_POD_DEPLOYMENT} -- psql -U teraxadmin -d postgres -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${TENANT_DB_USER}\";"

    # Cách ly bảo mật: Chặn public connect, chỉ cấp quyền cho tenant user
    kubectl exec -i deployment/${DB_POD_DEPLOYMENT} -- psql -U teraxadmin -d postgres -c "
REVOKE CONNECT ON DATABASE \"${DB_NAME}\" FROM PUBLIC;
GRANT ALL PRIVILEGES ON DATABASE \"${DB_NAME}\" TO \"${TENANT_DB_USER}\";
"

    echo "   📦 Nạp schema vào database..."
    kubectl exec -i deployment/${DB_POD_DEPLOYMENT} -- psql -U teraxadmin -d "${DB_NAME}" < "$INIT_SQL_PATH" > /dev/null

    # Cấp toàn quyền trên schema public cho TENANT_DB_USER
    kubectl exec -i deployment/${DB_POD_DEPLOYMENT} -- psql -U teraxadmin -d "${DB_NAME}" -c "
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
    echo "✅ Database và Dedicated User sẵn sàng."

    # 2. Tạo K8s Secret (dùng credentials riêng)
    echo "🔐 [2/4] Tạo Kubernetes Secret '${SECRET_NAME}'..."
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: ${SECRET_NAME}
  namespace: default
type: Opaque
stringData:
  DATABASE_URL: "postgres://${TENANT_DB_USER}:${TENANT_DB_PASS}@terax-postgres-service:5432/${DB_NAME}"
  PORT: "5221"
  JWT_SECRET: "${JWT_SECRET}"
  CMS_HMAC_SECRET: "${CMS_HMAC}"
  TENANT_SUBDOMAIN: "${TENANT_ID}"
  CMS_BASE_URL: "http://cms.terax.ai"
EOF

    # 3. Tạo K8s Deployment & Service (LoadBalancer)
    echo "🐳 [3/4] Tạo K8s Deployment & Service cho '${TENANT_ID}'..."
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${DEPLOYMENT_NAME}
  namespace: default
  labels:
    app: crc-app-${TENANT_ID}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: crc-app-${TENANT_ID}
  template:
    metadata:
      labels:
        app: crc-app-${TENANT_ID}
    spec:
      containers:
        - name: crc-app
          image: ${CRC_IMAGE_NAME}
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 5221
          envFrom:
            - secretRef:
                name: ${SECRET_NAME}
          resources:
            limits:
              memory: "${LIMIT_RAM:-512Mi}"
              cpu: "${LIMIT_CPU:-500m}"
            requests:
              memory: "128Mi"
              cpu: "50m"
---
apiVersion: v1
kind: Service
metadata:
  name: ${SERVICE_NAME}
  namespace: default
  labels:
    app: crc-app-${TENANT_ID}
spec:
  type: LoadBalancer
  selector:
    app: crc-app-${TENANT_ID}
  ports:
    - name: http
      port: ${PORT}
      targetPort: 5221
      protocol: TCP
EOF

    # 4. Tạo K8s Cloudflare Tunnel Deployment
    if [ "$TUNNEL_TOKEN" != "shared" ]; then
      echo "☁️  [4/4] Tạo K8s Cloudflare Tunnel cho '${TENANT_ID}'..."
      cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${TUNNEL_DEPLOYMENT_NAME}
  namespace: default
  labels:
    app: crc-tunnel-${TENANT_ID}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: crc-tunnel-${TENANT_ID}
  template:
    metadata:
      labels:
        app: crc-tunnel-${TENANT_ID}
    spec:
      containers:
        - name: cloudflared
          image: cloudflare/cloudflared:latest
          args: ["tunnel", "run"]
          env:
            - name: TUNNEL_TOKEN
              value: "${TUNNEL_TOKEN}"
EOF
    else
      echo "☁️  [4/4] Bỏ qua chạy Tunnel container riêng (dùng chung)."
    fi

    echo ""
    echo "=========================================================="
    echo "🎉 DEPLOY TENANT '${TENANT_ID}' THÀNH CÔNG LÊN KUBERNETES!"
    echo "=========================================================="
    ;;

  "suspend")
    echo "⏸️  Đang tạm ngưng tenant '${TENANT_ID}' trong K8s..."
    kubectl scale deployment/${DEPLOYMENT_NAME} --replicas=0
    kubectl scale deployment/${TUNNEL_DEPLOYMENT_NAME} --replicas=0 2>/dev/null || true
    echo "✅ Đã tạm ngưng."
    ;;

  "unsuspend")
    echo "▶️  Đang kích hoạt lại tenant '${TENANT_ID}' trong K8s..."
    kubectl scale deployment/${DEPLOYMENT_NAME} --replicas=1
    kubectl scale deployment/${TUNNEL_DEPLOYMENT_NAME} --replicas=1 2>/dev/null || true
    echo "✅ Đã kích hoạt lại."
    ;;

  "delete")
    echo "🗑️  Đang xóa vĩnh viễn tenant '${TENANT_ID}' khỏi K8s..."
    kubectl delete deployment/${DEPLOYMENT_NAME} service/${SERVICE_NAME} secret/${SECRET_NAME} --ignore-not-found
    kubectl delete deployment/${TUNNEL_DEPLOYMENT_NAME} --ignore-not-found
    echo "🗄️  Đang xóa database '${DB_NAME}' và Dedicated User '${TENANT_DB_USER}'..."
    kubectl exec -i deployment/${DB_POD_DEPLOYMENT} -- psql -U teraxadmin -d postgres -c "
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}';
DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE);
DROP ROLE IF EXISTS \"${TENANT_DB_USER}\";
" 2>/dev/null || true
    echo "✅ Đã xóa hoàn toàn."
    ;;
esac
