#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

# Color definitions for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

export KUBECONFIG="/home/terax/.kube/config"

START_INDEX=${1:-1}
END_INDEX=${2:-15}

PARENT_DIR="/opt/app"
HOST_PATH="/opt/app/terax_postgres_data"
PG_USER="teraxadmin"
PG_PASS="TeraX123!@#"

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}  🚀 KHÔI PHỤC TERAX ${START_INDEX}-${END_INDEX} SỬ DỤNG POD POSTGRESQL RIÊNG LẺ${NC}"
echo -e "${BLUE}==================================================================${NC}"

for ((i=START_INDEX; i<=END_INDEX; i++)); do
    TARGET_NAME="terax$i"
    TARGET_DIR="$PARENT_DIR/$TARGET_NAME"
    PG_NAME="${TARGET_NAME}-postgres"
    DB_NAME="teraxdb$i"
    NODE_PORT=$((30000 + i))

    NEW_DB_URL_K8S="postgres://teraxadmin:TeraX123%21%40%23@${PG_NAME}-service:5432/${DB_NAME}"
    NEW_ENV_DB_URL="postgres://teraxadmin:TeraX123!%40%23@${PG_NAME}-service:5432/${DB_NAME}"

    HOST_PATH="${TARGET_DIR}/pgdata"

    echo -e "------------------------------------------------------------"
    echo -e "⚙️ Đang xử lý: ${BLUE}${TARGET_NAME}${NC} (Pod PG: ${YELLOW}${PG_NAME}-db${NC})"
    echo -e "------------------------------------------------------------"

    mkdir -p "${HOST_PATH}"

    MANIFEST_FILE=$(mktemp)
    cat <<EOF > "$MANIFEST_FILE"
apiVersion: v1
kind: PersistentVolume
metadata:
  name: ${PG_NAME}-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: "${HOST_PATH}/"
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${PG_NAME}-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${PG_NAME}-db
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${PG_NAME}
  template:
    metadata:
      labels:
        app: ${PG_NAME}
    spec:
      containers:
      - name: postgres
        image: postgres:18
        args:
        - -c
        - max_connections=500
        - -c
        - shared_buffers=128MB
        - -c
        - work_mem=4MB
        env:
        - name: POSTGRES_USER
          value: "teraxadmin"
        - name: POSTGRES_PASSWORD
          value: "TeraX123!@#"
        - name: POSTGRES_DB
          value: "${DB_NAME}"
        ports:
        - containerPort: 5432
        resources:
          limits:
            cpu: "1"
            memory: "1280Mi"
          requests:
            cpu: "100m"
            memory: "256Mi"
        volumeMounts:
        - mountPath: /var/lib/postgresql
          name: db-storage
        - mountPath: /dev/shm
          name: dshm
      volumes:
      - name: db-storage
        persistentVolumeClaim:
          claimName: ${PG_NAME}-pvc
      - name: dshm
        emptyDir:
          medium: Memory
---
apiVersion: v1
kind: Service
metadata:
  name: ${PG_NAME}-service
spec:
  type: NodePort
  selector:
    app: ${PG_NAME}
  ports:
  - port: 5432
    targetPort: 5432
    nodePort: ${NODE_PORT}
EOF

    kubectl apply -f "$MANIFEST_FILE" > /dev/null
    rm -f "$MANIFEST_FILE"

    echo -e "  -> ⏳ Đang chờ Postgres Pod ${PG_NAME}-db sẵn sàng..."
    kubectl rollout status deployment/${PG_NAME}-db --timeout=120s > /dev/null

    # Check if table count > 10 in new DB, else import init.sql
    TABLE_COUNT=$(kubectl exec deployment/${PG_NAME}-db -- psql -U "$PG_USER" -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "0")
    if [ "$TABLE_COUNT" -lt 10 ]; then
        INIT_SQL=""
        if [ -f "$TARGET_DIR/init.sql" ]; then
            INIT_SQL="$TARGET_DIR/init.sql"
        elif [ -f "$PARENT_DIR/dev/crc_app/init.sql" ]; then
            INIT_SQL="$PARENT_DIR/dev/crc_app/init.sql"
        fi

        if [ -n "$INIT_SQL" ]; then
            echo -e "  -> 📥 Đang nạp schema từ ${INIT_SQL}..."
            kubectl exec -i deployment/${PG_NAME}-db -- psql -U "$PG_USER" -d "$DB_NAME" < "$INIT_SQL" > /dev/null 2>&1 || true
        fi
    fi

    # Update .env
    ENV_FILE="$TARGET_DIR/.env"
    if [ -f "$ENV_FILE" ]; then
        echo -e "  -> 📝 Đang cập nhật .env..."
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=${NEW_ENV_DB_URL}|g" "$ENV_FILE"
    fi

    # Update k8s-manifest.yaml
    K8S_FILE="$TARGET_DIR/k8s-manifest.yaml"
    if [ -f "$K8S_FILE" ]; then
        echo -e "  -> ☸️ Đang cập nhật k8s-manifest.yaml..."
        sed -i "s|DATABASE_URL: .*|DATABASE_URL: \"${NEW_DB_URL_K8S}\"|g" "$K8S_FILE"
        kubectl apply -f "$K8S_FILE" > /dev/null
    fi

    # Update k8s-dev-cms.yaml
    K8S_DEV_FILE="$TARGET_DIR/k8s-dev-cms.yaml"
    if [ -f "$K8S_DEV_FILE" ]; then
        sed -i "s|DATABASE_URL: .*|DATABASE_URL: \"${NEW_DB_URL_K8S}\"|g" "$K8S_DEV_FILE" 2>/dev/null || true
    fi

    # Restart app pod
    echo -e "  -> 🔄 Restarting deployment/${TARGET_NAME}-deployment..."
    kubectl rollout restart deployment/${TARGET_NAME}-deployment > /dev/null 2>&1 || true

    echo -e "  -> ${GREEN}✓ Đã khôi phục thành công ${TARGET_NAME}!${NC}"
done

echo -e "\n${GREEN}🎉 HOÀN THÀNH! Toàn bộ Terax ${START_INDEX}-${END_INDEX} đã được khôi phục về Pod Postgres riêng lẻ.${NC}"
