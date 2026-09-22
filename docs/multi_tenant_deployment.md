# Giải pháp Nhân bản Ứng dụng theo Subdomain trên VPS với Nginx & Docker

Khi bạn muốn triển khai mô hình **Multi-Instance** (mỗi khách hàng có một ứng dụng chạy port riêng, database riêng, subdomain riêng) trên cùng một VPS đã cài sẵn Nginx ở cổng 80/443, phương pháp tối ưu và chuyên nghiệp nhất là **không nhân bản mã nguồn vật lý** (không copy thư mục code). Thay vào đó, bạn sẽ chạy nhiều **Docker Container** từ cùng một Docker Image nhưng cấu hình khác cổng (port) và biến môi trường (environment variables).

---

## 1. KIẾN TRÚC TỔNG QUAN

```mermaid
graph TD
    User([Khách hàng truy cập *.domain.com]) -->|Port 80/443| NginxHost[Nginx trên VPS Host]
    NginxHost -->|Proxy Pass| Subdomain1[client1.domain.com --> 127.0.0.1:5001]
    NginxHost -->|Proxy Pass| Subdomain2[client2.domain.com --> 127.0.0.1:5002]
    
    subgraph Docker Containers
        Container1[Container CRC client1 <br> Port 5001] --> DB1[(Database: crc_client1)]
        Container2[Container CRC client2 <br> Port 5002] --> DB2[(Database: crc_client2)]
    end
```

---

## 2. NGUYÊN LÝ HOẠT ĐỘNG
Để tạo một khách hàng mới (ví dụ: `client1` dùng subdomain `client1.domain.com` chạy cổng `5001`):
1. **Docker:** Chạy 1 container mới từ Image của app, map cổng `5001` trên VPS vào cổng `5221` của container.
2. **Nginx:** Tạo 1 file cấu hình Nginx nhỏ tại `/etc/nginx/sites-enabled/client1.conf` cấu hình `proxy_pass http://127.0.0.1:5001;`.
3. **SSL (HTTPS):** Sử dụng Let's Encrypt Wildcard SSL (`*.domain.com`) cấu hình một lần duy nhất cho toàn bộ subdomains.
4. **Reload:** Thực hiện `nginx -s reload` (không gây gián đoạn các khách hàng đang truy cập).

---

## 3. SCRIPT TỰ ĐỘNG HÓA THAO TÁC (BASH SCRIPT)

Dưới đây là mã script Bash giúp bạn tự động hóa 100% việc clone app, tạo database, tạo cấu hình Nginx và kích hoạt subdomain mới. 

Bạn hãy tạo file `add_tenant.sh` trên VPS với nội dung sau:

```bash
#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

# CẤU HÌNH GỐC
DOMAIN="domain.com" # Thay bằng domain của bạn
SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem" # Đường dẫn SSL wildcard
SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"

# Đọc tham số đầu vào
TENANT_ID=$1
PORT=$2

if [ -z "$TENANT_ID" ] || [ -z "$PORT" ]; then
    echo "❌ Lỗi: Thiếu tham số!"
    echo "Sử dụng: ./add_tenant.sh <tên_subdomain> <cổng_chạy>"
    echo "Ví dụ: ./add_tenant.sh client1 5001"
    exit 1
fi

SUBDOMAIN="${TENANT_ID}.${DOMAIN}"
CONTAINER_NAME="crc_app_${TENANT_ID}"
DB_NAME="crc_db_${TENANT_ID}"

echo "=========================================================="
echo "   ĐANG TRIỂN KHAI SUBDOMAIN: $SUBDOMAIN TRÊN CỔNG: $PORT"
echo "=========================================================="

# 1. Tự động tạo Database mới cho Tenant
echo "🗄️  Đang tạo database '$DB_NAME'..."
# Giả sử bạn đang chạy một PostgreSQL chung (hoặc chạy qua Docker)
docker exec -i crc_db_standalone psql -U crc_user -d postgres -c "CREATE DATABASE $DB_NAME;" || echo "⚠️ DB đã tồn tại hoặc tự khởi tạo."

# Nạp cấu hình mẫu vào database mới tạo
docker exec -i crc_db_standalone psql -U crc_user -d $DB_NAME < /root/crc_app/scripts/db/init.sql || echo "⚠️ Đã nạp DB."

# 2. Chạy Docker Container cho Tenant mới sử dụng chung image
echo "🚀 Đang khởi chạy Container cho khách hàng: $CONTAINER_NAME..."
# Đầu tiên, build image gốc nếu chưa có (chỉ cần build 1 lần duy nhất)
docker build -t crc_app_image /root/crc_app/.

# Xóa container cũ nếu trùng tên
docker rm -f $CONTAINER_NAME 2>/dev/null || true

# Chạy container mới với biến môi trường riêng biệt
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$PORT:5221" \
  -e PORT="5221" \
  -e DATABASE_URL="postgres://crc_user:crc2026@crc_db_standalone:5432/$DB_NAME" \
  -e JWT_SECRET="secret_key_for_${TENANT_ID}_$(openssl rand -hex 12)" \
  --network crc_app_default \
  --restart always \
  crc_app_image

# 3. Tạo cấu hình Nginx tự động trỏ subdomain về Port mới
NGINX_CONF="/etc/nginx/sites-available/$SUBDOMAIN.conf"
echo "🌐 Đang tạo cấu hình Nginx tại: $NGINX_CONF..."

cat <<EOF > $NGINX_CONF
server {
    listen 80;
    server_name $SUBDOMAIN;
    
    # Tự động redirect sang HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $SUBDOMAIN;

    # Cấu hình SSL Wildcard
    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Lấy IP thật của client
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Kích hoạt cấu hình Nginx
ln -sf $NGINX_CONF /etc/nginx/sites-enabled/

# 4. Kiểm tra cấu hình và reload Nginx
echo "🔄 Đang reload Nginx..."
nginx -t
systemctl reload nginx

echo "=========================================================="
echo "🎉 ĐÃ KÍCH HOẠT THÀNH CÔNG!"
echo "🌐 URL: https://$SUBDOMAIN"
echo "🖥️  Cổng nội bộ: $PORT"
echo "=========================================================="
```

---

## 4. HƯỚNG DẪN CẤU HÌNH WILDCARD SSL (Để Nginx chạy HTTPS tự động)

Vì bạn dùng các subdomain biến động (`client1.domain.com`, `client2.domain.com`), việc tạo chứng chỉ SSL thủ công cho từng subdomain rất bất tiện. Giải pháp là tạo **1 chứng chỉ Wildcard** (`*.domain.com`) bằng **Certbot** qua xác thực DNS (DNS Challenge):

```bash
# Cài đặt certbot
sudo apt install certbot python3-certbot-nginx -y

# Đăng ký chứng chỉ wildcard (Cần thêm bản ghi TXT vào DNS của domain để xác thực)
sudo certbot certonly --manual --preferred-challenges=dns --email your-email@gmail.com -d domain.com -d "*.domain.com"
```
Lúc này, Certbot sẽ cấp cho bạn đường dẫn chứng chỉ:
*   `ssl_certificate` -> `/etc/letsencrypt/live/domain.com/fullchain.pem`
*   `ssl_certificate_key` -> `/etc/letsencrypt/live/domain.com/privkey.pem`
Đường dẫn này được cấu hình mặc định trong file config Nginx tự động sinh ra ở bước trên.

---

## 5. THAO TÁC KHI CÓ KHÁCH HÀNG MỚI (CỰC KỲ ĐƠN GIẢN)

Mỗi khi bạn muốn tạo một khách hàng mới, bạn chỉ cần thực hiện đúng **một câu lệnh duy nhất** trên VPS:

```bash
# Cú pháp: ./add_tenant.sh <tên_subdomain> <cổng_chạy>
./add_tenant.sh client1 5001
```

Hệ thống sẽ tự động:
1. Tạo Database `crc_db_client1` và nạp schema gốc.
2. Build và khởi chạy Docker Container chạy ngầm tên `crc_app_client1` ở cổng `5001`.
3. Tạo cấu hình Nginx và trỏ subdomain `client1.domain.com` về cổng `5001`.
4. Reload Nginx để subdomain hoạt động ngay lập tức.
