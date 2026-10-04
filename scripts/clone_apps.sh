#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

# Color definitions for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure the script is run with sudo/root since /opt/app is owned by root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Lỗi: Vui lòng chạy script này với quyền root hoặc sudo!${NC}"
    echo -e "👉 Ví dụ: ${YELLOW}sudo ./clone_apps.sh${NC}"
    exit 1
fi

# Base directory paths
SOURCE_DIR="/opt/app/dev/crc_app"
PARENT_DIR="/opt/app"

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}          🚀 SCRIPT COPY VÀ CẤU HÌNH NHANH APP PRODUCTION         ${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo -e "Thư mục gốc: ${YELLOW}$SOURCE_DIR${NC}\n"

# 1. Ask for number of apps
read -p "1. Nhập số lượng app muốn tạo: " NUM_APPS
if [[ ! "$NUM_APPS" =~ ^[0-9]+$ ]] || [ "$NUM_APPS" -le 0 ]; then
    echo -e "${RED}❌ Lỗi: Số lượng app phải là một số nguyên dương!${NC}"
    exit 1
fi

# 2. Ask for Port Range
read -p "2. Nhập cổng bắt đầu (Start Port): " START_PORT
if [[ ! "$START_PORT" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}❌ Lỗi: Cổng bắt đầu phải là số nguyên!${NC}"
    exit 1
fi

read -p "   Nhập cổng kết thúc (End Port): " END_PORT
if [[ ! "$END_PORT" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}❌ Lỗi: Cổng kết thúc phải là số nguyên!${NC}"
    exit 1
fi

# Validate Port range size
PORT_COUNT=$((END_PORT - START_PORT + 1))
if [ "$PORT_COUNT" -ne "$NUM_APPS" ]; then
    echo -e "${RED}❌ Lỗi: Khoảng cổng từ $START_PORT đến $END_PORT gồm ($PORT_COUNT) cổng, không khớp với số lượng app cần tạo ($NUM_APPS)!${NC}"
    exit 1
fi

# 3. Ask for Numbering Range (Start/End index)
read -p "3. Nhập số thứ tự bắt đầu (Start Index): " START_INDEX
if [[ ! "$START_INDEX" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}❌ Lỗi: Số thứ tự bắt đầu phải là số nguyên!${NC}"
    exit 1
fi

read -p "   Nhập số thứ tự kết thúc (End Index): " END_INDEX
if [[ ! "$END_INDEX" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}❌ Lỗi: Số thứ tự kết thúc phải là số nguyên!${NC}"
    exit 1
fi

# Validate indexing range size
INDEX_COUNT=$((END_INDEX - START_INDEX + 1))
if [ "$INDEX_COUNT" -ne "$NUM_APPS" ]; then
    echo -e "${RED}❌ Lỗi: Khoảng số thứ tự từ $START_INDEX đến $END_INDEX gồm ($INDEX_COUNT) số, không khớp với số lượng app cần tạo ($NUM_APPS)!${NC}"
    exit 1
fi

# Confirmation prompt
echo -e "\n${BLUE}--- THÔNG TIN XÁC NHẬN ---${NC}"
echo -e "• Số lượng app sẽ tạo: ${GREEN}$NUM_APPS${NC}"
echo -e "• Khoảng cổng chạy    : ${GREEN}$START_PORT${NC} ➔ ${GREEN}$END_PORT${NC}"
echo -e "• Tên các thư mục app : ${GREEN}terax$START_INDEX${NC} ➔ ${GREEN}terax$END_INDEX${NC}"
echo -e "--------------------------"
read -p "Bạn có chắc chắn muốn tiến hành copy? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️ Đã hủy thao tác.${NC}"
    exit 0
fi

# Kiểm tra Postgres DB deployment trong K8s
export KUBECONFIG="/home/terax/.kube/config"
if ! kubectl get deployment/terax-postgres-db >/dev/null 2>&1; then
    echo -e "${RED}❌ Lỗi: Chưa tìm thấy deployment 'terax-postgres-db' trong Kubernetes!${NC}"
    echo -e "👉 Vui lòng khởi tạo Postgres bằng lệnh: ${YELLOW}kubectl apply -f /opt/app/dev/docs/postgres-terax.yaml${NC}"
    exit 1
fi

# Loop to copy and customize apps
for ((i=0; i<NUM_APPS; i++)); do
    CURRENT_INDEX=$((START_INDEX + i))
    CURRENT_PORT=$((START_PORT + i))
    TARGET_NAME="terax$CURRENT_INDEX"
    TARGET_DIR="$PARENT_DIR/$TARGET_NAME"

    echo -e "\n------------------------------------------------------------"
    echo -e "⚙️ Đang xử lý: ${BLUE}$TARGET_NAME${NC} | Cổng: ${BLUE}$CURRENT_PORT${NC}"
    echo -e "------------------------------------------------------------"

    # Check if target directory exists
    if [ -d "$TARGET_DIR" ]; then
        echo -e "${YELLOW}⚠️ Cảnh báo: Thư mục $TARGET_DIR đã tồn tại.${NC}"
        read -p "   Bạn có muốn ghi đè? (y/N): " OVERWRITE
        if [[ "$OVERWRITE" =~ ^[Yy]$ ]]; then
            echo -e "   -> Đang xóa thư mục cũ..."
            rm -rf "$TARGET_DIR"
        else
            echo -e "   -> ${YELLOW}Bỏ qua $TARGET_NAME.${NC}"
            continue
        fi
    fi

    # Copy files while excluding large or unnecessary directories/files, and excluding the clone script itself
    echo -e "📁 Đang sao chép từ $SOURCE_DIR..."
    rsync -aq --exclude 'node_modules' --exclude '.git' --exclude 'CRC_App_Docker_Ready.tar.gz' --exclude 'CRC_App_Docker_Ready.zip' --exclude 'clone_apps.sh' "$SOURCE_DIR/" "$TARGET_DIR/"

    # 1. Update .env
    ENV_FILE="$TARGET_DIR/.env"
    NODE_PORT=$((30543 + CURRENT_INDEX))
    NEW_DB_URL="postgres://teraxadmin:TeraX123!%40%23@${TARGET_NAME}-postgres-service:5432/teraxdb${CURRENT_INDEX}"
    if [ -f "$ENV_FILE" ]; then
        echo -e "📝 Đang cấu hình file .env..."
        # Replace PORT line
        sed -i "s/^PORT=.*/PORT=$CURRENT_PORT/g" "$ENV_FILE"
        # Replace DATABASE_URL line
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=${NEW_DB_URL}|g" "$ENV_FILE"
    fi

    # 2. Tạo và cấu hình Dedicated Database Pod mới trong K8s (2Gi RAM limit)
    echo -e "🗄️ Đang khởi tạo Dedicated PostgreSQL Pod (2Gi Limit) cho ${TARGET_NAME}..."
    export KUBECONFIG="/home/terax/.kube/config"
    DB_NAME="teraxdb${CURRENT_INDEX}"
    PG_NAME="${TARGET_NAME}-postgres"
    HOST_PATH="/opt/postgresql/terax/${TARGET_NAME}"

    mkdir -p "$HOST_PATH"
    chmod -R 777 "$HOST_PATH"

    MANIFEST_FILE="/tmp/${PG_NAME}.yaml"
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

    echo -e "   -> Đang chờ Postgres Pod của ${TARGET_NAME} sẵn sàng..."
    kubectl rollout status deployment/${PG_NAME}-db --timeout=120s > /dev/null

    # Nạp dữ liệu cấu trúc (schema) từ init.sql của app vào database mới
    if [ -f "$TARGET_DIR/init.sql" ]; then
        echo -e "   -> Đang nạp schema (init.sql) vào database ${DB_NAME}..."
        kubectl exec -i deployment/${PG_NAME}-db -- psql -U teraxadmin -d "${DB_NAME}" < "$TARGET_DIR/init.sql" > /dev/null 2>&1 || true
        echo -e "   -> Nạp schema thành công."
    else
        echo -e "   -> ${YELLOW}Cảnh báo: Không tìm thấy file init.sql để nạp schema!${NC}"
    fi

    # 3. Update docker-compose.yml and docker-compose.standalone.yml
    for COMPOSE_FILE in "docker-compose.yml" "docker-compose.standalone.yml"; do
        FILE_PATH="$TARGET_DIR/$COMPOSE_FILE"
        if [ -f "$FILE_PATH" ]; then
            echo -e "🐳 Đang cấu hình $COMPOSE_FILE..."
            # Replace container names
            sed -i "s/container_name: crc_web_app/container_name: ${TARGET_NAME}_web_app/g" "$FILE_PATH"
            sed -i "s/container_name: crc_web_app_standalone/container_name: ${TARGET_NAME}_web_app_standalone/g" "$FILE_PATH"
            sed -i "s/container_name: crc_tunnel/container_name: ${TARGET_NAME}_tunnel/g" "$FILE_PATH"
            sed -i "s/container_name: crc_tunnel_standalone/container_name: ${TARGET_NAME}_tunnel_standalone/g" "$FILE_PATH"
            sed -i "s/container_name: crc_dozzle/container_name: ${TARGET_NAME}_dozzle/g" "$FILE_PATH"
            sed -i "s/container_name: crc_dozzle_standalone/container_name: ${TARGET_NAME}_dozzle_standalone/g" "$FILE_PATH"
            
            # Update web port mapping (mapped host_port:container_port)
            sed -i "s/\"5221:5221\"/\"$CURRENT_PORT:$CURRENT_PORT\"/g" "$FILE_PATH"
            
            # Update dozzle port mapping to avoid conflicts (8080 + index)
            CURRENT_DOZZLE_PORT=$((8080 + CURRENT_INDEX))
            sed -i "s/\"8080:8080\"/\"$CURRENT_DOZZLE_PORT:8080\"/g" "$FILE_PATH"
        fi
    done

    # 4. Update k8s-manifest.yaml
    K8S_FILE="$TARGET_DIR/k8s-manifest.yaml"
    if [ -f "$K8S_FILE" ]; then
        echo -e "☸️ Đang cấu hình k8s-manifest.yaml..."
        # Replace resource names and labels
        sed -i "s/crc-app-env/${TARGET_NAME}-env/g" "$K8S_FILE"
        sed -i "s/crc-app-deployment/${TARGET_NAME}-deployment/g" "$K8S_FILE"
        sed -i "s/crc-app-service/${TARGET_NAME}-service/g" "$K8S_FILE"
        sed -i "s/app: crc-web-app/app: ${TARGET_NAME}/g" "$K8S_FILE"
        sed -i "s/name: crc-web-app/name: ${TARGET_NAME}/g" "$K8S_FILE"
        
        # Update ports
        sed -i "s/containerPort: 5221/containerPort: $CURRENT_PORT/g" "$K8S_FILE"
        sed -i "s/port: 5221/port: $CURRENT_PORT/g" "$K8S_FILE"
        sed -i "s/targetPort: 5221/targetPort: $CURRENT_PORT/g" "$K8S_FILE"
        sed -i "s/PORT: \"5221\"/PORT: \"$CURRENT_PORT\"/g" "$K8S_FILE"
        # Update database name and URL
        sed -i "s|DATABASE_URL: .*|DATABASE_URL: \"${NEW_DB_URL}\"|g" "$K8S_FILE"
    fi

    # 5. Update k8s-dev-cms.yaml
    K8S_DEV_FILE="$TARGET_DIR/k8s-dev-cms.yaml"
    if [ -f "$K8S_DEV_FILE" ]; then
        echo -e "☸️ Đang cấu hình k8s-dev-cms.yaml..."
        sed -i "s/crc-dev-env/${TARGET_NAME}-dev-env/g" "$K8S_DEV_FILE"
        sed -i "s/crc-dev-deployment/${TARGET_NAME}-dev-deployment/g" "$K8S_DEV_FILE"
        sed -i "s/crc-dev-service/${TARGET_NAME}-dev-service/g" "$K8S_DEV_FILE"
        sed -i "s/app: crc-dev-app/app: ${TARGET_NAME}-dev/g" "$K8S_DEV_FILE"
        sed -i "s/name: crc-dev-app/name: ${TARGET_NAME}-dev/g" "$K8S_DEV_FILE"
        
        # Update ports
        sed -i "s/containerPort: 5221/containerPort: $CURRENT_PORT/g" "$K8S_DEV_FILE"
        sed -i "s/port: 5222/port: $((CURRENT_PORT + 1))/g" "$K8S_DEV_FILE"
        sed -i "s/targetPort: 5221/targetPort: $CURRENT_PORT/g" "$K8S_DEV_FILE"
        sed -i "s/PORT: \"5221\"/PORT: \"$CURRENT_PORT\"/g" "$K8S_DEV_FILE"
        # Update database name
        sed -i "s|/teraxdb|/teraxdb$CURRENT_INDEX|g" "$K8S_DEV_FILE"
    fi

    # 6. Dynamically replace all /opt/app/terax paths with /opt/app/terax* in all files
    echo -e "🔗 Đang cập nhật đường dẫn nội bộ..."
    find "$TARGET_DIR" -type f | while read -r file; do
        if grep -q '/opt/app/terax' "$file"; then
            sed -i "s|/opt/app/terax|/opt/app/$TARGET_NAME|g" "$file"
        fi
    done

    # 7. Change ownership back to terax user
    chown -R terax:terax "$TARGET_DIR"

    # 8. Deploy app directly to Kubernetes immediately
    if [ -f "$TARGET_DIR/k8s-manifest.yaml" ]; then
        echo -e "☸️ Đang triển khai ${TARGET_NAME} lên Kubernetes..."
        kubectl apply -f "$TARGET_DIR/k8s-manifest.yaml" > /dev/null
    fi

    echo -e "${GREEN}✓ Xử lý và triển khai thành công $TARGET_NAME!${NC}"
done

echo -e "\n${GREEN}🎉 Hoàn thành! Đã tạo và cấu hình thành công các bản copy app.${NC}"

# Ask if they want to deploy the cloned apps to Kubernetes immediately
read -p "🚀 Bạn có muốn triển khai (deploy) các app mới này lên Kubernetes luôn không? (y/N): " DEPLOY_CONFIRM
if [[ "$DEPLOY_CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "\n☸️ Đang triển khai các app lên Kubernetes..."
    export KUBECONFIG="/home/terax/.kube/config"
    for ((i=0; i<NUM_APPS; i++)); do
        CURRENT_INDEX=$((START_INDEX + i))
        TARGET_NAME="terax$CURRENT_INDEX"
        TARGET_DIR="$PARENT_DIR/$TARGET_NAME"
        if [ -f "$TARGET_DIR/k8s-manifest.yaml" ]; then
            echo -e "   -> Triển khai ${TARGET_NAME}..."
            kubectl apply -f "$TARGET_DIR/k8s-manifest.yaml"
        fi
    done
    echo -e "${GREEN}✓ Đã triển khai xong toàn bộ app lên Kubernetes!${NC}"
else
    echo -e "\n👉 Để triển khai thủ công lên Kubernetes, bạn có thể chạy lệnh:"
    echo -e "   ${YELLOW}export KUBECONFIG=\"/home/terax/.kube/config\"${NC}"
    echo -e "   ${YELLOW}kubectl apply -f /opt/app/terax<index>/k8s-manifest.yaml${NC}"
    echo -e "   (Ví dụ: ${BLUE}kubectl apply -f /opt/app/terax1/k8s-manifest.yaml${NC})"
fi

