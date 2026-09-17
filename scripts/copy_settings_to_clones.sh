#!/bin/bash
# ==============================================================================
# SCRIPT COPY SETTING & PROCESS DATA TO CLONE APP TENANTS
# ==============================================================================
# Script nay copy cac bang Setting / Master (My Company, Employee, Process, Rules,
# Permissions, Sys Lookups) va xoa sach cac bang Request / Transaction de test.
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

export KUBECONFIG="/home/terax/.kube/config"

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}  ⚙️ SCRIPT DỒN CẤU HÌNH (SETTING & PROCESS) CHO APP TENANTS        ${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Danh sach cac bang Transactional / Request can xoa/reset
TRANSACTION_TABLES="request, comment, notification, account, asset, contact, contract, expense, invoice, mtr, operation_program, oppotunity, payment, policy_and_program, project, service"

# Options
AUTO_CONFIRM=false
TARGET_APPS=()

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -y|--yes) AUTO_CONFIRM=true ;;
        --all)
            for i in $(seq 1 15); do TARGET_APPS+=("terax$i"); done
            ;;
        --range)
            shift
            if [[ "$1" =~ ^([0-9]+)-([0-9]+)$ ]]; then
                START_IDX="${BASH_REMATCH[1]}"
                END_IDX="${BASH_REMATCH[2]}"
                for ((i=START_IDX; i<=END_IDX; i++)); do TARGET_APPS+=("terax$i"); done
            else
                echo -e "${RED}❌ Định dạng range sai. Ví dụ: --range 1-5${NC}"
                exit 1
            fi
            ;;
        --apps)
            shift
            IFS=',' read -r -a APPS_ARRAY <<< "$1"
            for app in "${APPS_ARRAY[@]}"; do TARGET_APPS+=("$app"); done
            ;;
        *)
            echo -e "${YELLOW}Cú pháp hỗ trợ: $0 [--all | --range 1-15 | --apps terax1,terax2] [-y]${NC}"
            ;;
    esac
    shift
done

# Interactively ask if no apps specified
if [ ${#TARGET_APPS[@]} -eq 0 ]; then
    echo -e "Chọn phương thức copy Setting:"
    echo -e "  1. Tất cả app đang chạy (terax1 - terax15)"
    echo -e "  2. Nhập dải thứ tự (Ví dụ: 1-5)"
    echo -e "  3. Nhập danh sách chỉ định (Ví dụ: 1,2,3)"
    read -p "Lựa chọn của bạn (1-3): " CHOICE

    case $CHOICE in
        1)
            for i in $(seq 1 15); do TARGET_APPS+=("terax$i"); done
            ;;
        2)
            read -p "Nhập dải thứ tự (Ví dụ 1-5): " R_INPUT
            if [[ "$R_INPUT" =~ ^([0-9]+)-([0-9]+)$ ]]; then
                START_IDX="${BASH_REMATCH[1]}"
                END_IDX="${BASH_REMATCH[2]}"
                for ((i=START_IDX; i<=END_IDX; i++)); do TARGET_APPS+=("terax$i"); done
            else
                echo -e "${RED}❌ Định dạng không hợp lệ!${NC}"
                exit 1
            fi
            ;;
        3)
            read -p "Nhập danh sách số thứ tự cách nhau bởi dấu phẩy (Ví dụ 1,2,3): " C_INPUT
            IFS=',' read -r -a INDEX_ARRAY <<< "$C_INPUT"
            for idx in "${INDEX_ARRAY[@]}"; do TARGET_APPS+=("terax$idx"); done
            ;;
        *)
            echo -e "${RED}❌ Lựa chọn không hợp lệ!${NC}"
            exit 1
            ;;
    esac
fi

echo -e "\n📋 Danh sách app sẽ nạp Setting & Reset dữ liệu Request:"
for app in "${TARGET_APPS[@]}"; do
    echo -e "   - ${GREEN}$app${NC}"
done

if [ "$AUTO_CONFIRM" = false ]; then
    read -p "Bạn có chắc chắn muốn nạp Setting và xóa toàn bộ dữ liệu Request cũ? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠️ Đã hủy thao tác.${NC}"
        exit 0
    fi
fi

# Path to template init.sql
TEMPLATE_SQL="/opt/app/dev/crc_app/init.sql"
if [ ! -f "$TEMPLATE_SQL" ]; then
    TEMPLATE_SQL="/opt/app/terax/init.sql"
fi
if [ ! -f "$TEMPLATE_SQL" ]; then
    echo -e "${RED}❌ Lỗi: Không tìm thấy file mẫu $TEMPLATE_SQL!${NC}"
    exit 1
fi

echo -e "\n🚀 Bắt đầu quá trình nạp Setting..."

for APP_NAME in "${TARGET_APPS[@]}"; do
    INDEX=$(echo "$APP_NAME" | sed 's/[^0-9]//g')
    DB_NAME="teraxdb${INDEX}"
    PG_DEPLOYMENT="${APP_NAME}-postgres-db"

    # Check if DB deployment exists in K8s
    if ! kubectl get deployment/"$PG_DEPLOYMENT" >/dev/null 2>&1; then
        echo -e "⚠️ ${YELLOW}Bỏ qua ${APP_NAME}: Deployment ${PG_DEPLOYMENT} chưa tồn tại trong K8s.${NC}"
        continue
    fi

    echo -e "\n------------------------------------------------------------"
    echo -e "⚙️ Đang xử lý Setting cho ${BLUE}${APP_NAME}${NC} (DB: ${GREEN}${DB_NAME}${NC})..."
    echo -e "------------------------------------------------------------"

    # Step 1: Re-import full schema and master data from template init.sql
    echo -e "   -> Nạp cấu hình mẫu (My Company, Employee, Rules, Permissions, Sys lookups)..."
    kubectl exec -i deployment/"$PG_DEPLOYMENT" -- psql -U teraxadmin -d "${DB_NAME}" < "$TEMPLATE_SQL" >/dev/null 2>&1 || true

    # Step 2: Truncate / Clear all request and transactional tables
    echo -e "   -> 🗑️ Xóa sạch dữ liệu Request & Giao dịch để sẵn sàng test..."
    kubectl exec deployment/"$PG_DEPLOYMENT" -- psql -U teraxadmin -d "${DB_NAME}" -c \
        "TRUNCATE TABLE ${TRANSACTION_TABLES} CASCADE;" >/dev/null 2>&1 || true

    echo -e "   ${GREEN}✓ Đã hoàn tất Setting cho ${APP_NAME}!${NC}"
done

echo -e "\n${GREEN}🎉 TẤT CẢ HOÀN TẤT! Các tenant đã có đầy đủ Setting (Company, Employee, Process, Rules) và sẵn sàng để test Request mới.${NC}"
