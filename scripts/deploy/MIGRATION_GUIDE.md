# CRC App - Hướng dẫn di chuyển và vận hành hệ thống (Migration & Operation Guide)

Tài liệu này hướng dẫn cách di chuyển và vận hành hệ thống `CRC_app` trên cả hai môi trường: Kubernetes (Server mới PC Mini) và Standalone Docker Compose (VPS cũ).

---

## 🖥️ Môi trường 1: Kubernetes K3s (Server mới PC Mini - `10.91.1.51`)

Dành cho môi trường production chính thức mới tại PC Mini để quản lý và vận hành thông qua Kubernetes.

### 📋 Thông tin cấu hình
- **Thư mục Code:** `/opt/app/terax`
- **File Manifest:** `/opt/app/terax/k8s-manifest.yaml`
- **Các tài nguyên K8s:**
  - `Secret`: `crc-app-env`
  - `Deployment`: `crc-app-deployment`
  - `Service`: `crc-app-service` (Exposed cổng `5221` qua LoadBalancer)
  - `Deployment & Service`: `dozzle-deployment` (Exposed log viewer qua cổng `8080`)

### 🚀 Lệnh vận hành nhanh (SSH vào `10.91.1.51`):
*   **Xem logs:** `sudo kubectl logs -f deployment/crc-app-deployment`
*   **Khởi động lại Pod:** `sudo kubectl rollout restart deployment/crc-app-deployment`
*   **Áp dụng cấu hình manifest:** `sudo kubectl apply -f /opt/app/terax/k8s-manifest.yaml`

---

## 🐳 Môi trường 2: Standalone Docker Compose (VPS cũ - `100.70.140.42`)

Dành cho việc chạy thử nghiệm độc lập hoặc dự phòng trên VPS cũ sử dụng Docker Compose thông thường.

### 📋 Thông tin cấu hình
- **File cấu hình:** `docker-compose.standalone.yml`
- **Thư mục Code:** `/home/alui98hp/crc_app`
- **Các Services chạy trong Docker Compose:**
  1.  `db` (Postgres database độc lập cổng `9999`)
  2.  `app` (CRC Web App cổng `5221`)
  3.  `cloudflared` (Đường hầm Cloudflare kết nối tên miền bằng token)
  4.  `dozzle` (Log viewer cổng `8080`)

### 🚀 Lệnh vận hành nhanh (SSH vào `100.70.140.42`):
*   **Khởi chạy hệ thống:**
    ```bash
    docker compose -f docker-compose.standalone.yml up -d --build
    ```
*   **Dừng hệ thống:**
    ```bash
    docker compose -f docker-compose.standalone.yml down
    ```
*   **Xem logs:**
    ```bash
    docker logs -f crc_web_app_standalone
    ```
