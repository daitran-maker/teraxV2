# HƯỚNG DẪN DEMO QUY TRÌNH THÊM KHÁCH HÀNG MỚI & KIẾN TRÚC BẢO MẬT TRÊN VPS

Tài liệu này hướng dẫn chi tiết các bước bạn cần thực hiện trên VPS để trình diễn (demo) trực quan cho đối tác/khách hàng khi họ hỏi:
1. **Khi có khách hàng mới (Tenant mới), hệ thống sẽ làm gì? (Tự động hóa onboarding)**
2. **Bảo mật của hệ thống hiện tại đang được cấu hình ra sao? (Kiến trúc bảo mật đa lớp)**

---

## PHẦN 1: DEMO QUY TRÌNH THÊM KHÁCH HÀNG MỚI (MULTI-TENANT DOCKER + NGINX)

Để chứng minh khả năng tự động hóa và sự độc lập dữ liệu giữa các khách hàng, hãy thực hiện các bước sau ngay trên cửa sổ terminal kết nối SSH vào VPS:

### Bước 1: Giới thiệu Script Tự Động Hóa (`add_tenant.sh`)
Show cho họ thấy bạn quản lý việc onboarding bằng một script tự động hóa, tránh các lỗi cấu hình thủ công:
```bash
cat /root/crc_app/add_tenant.sh
```
*Giải thích với khách:* Script này sẽ tự động hóa 100% quá trình tạo cơ sở dữ liệu mới, chạy container ứng dụng riêng biệt và cấu hình máy chủ web Nginx.

### Bước 2: Chạy trực tiếp demo thêm một Khách hàng thử nghiệm
Chạy script với một subdomain giả lập (ví dụ: `khtest` chạy cổng `5099`):
```bash
sudo /root/crc_app/add_tenant.sh khtest 5099
```
*Giải thích các tiến trình đang chạy trên màn hình:*
1. **Tạo Database riêng biệt:** Khởi tạo DB `crc_db_khtest` độc lập và nạp cấu hình bảng biểu chuẩn.
2. **Khởi tạo Container độc lập:** Khởi chạy một container Docker mới tên `crc_app_khtest` chạy ngầm.
3. **Cấu hình Reverse Proxy & SSL tự động:** Tạo file cấu hình Nginx riêng cho subdomain `khtest.domain.com` và tự động trỏ về cổng `5099`.
4. **Reload Web Server không downtime:** Nginx reload cấu hình ngay lập tức mà không làm gián đoạn bất kỳ khách hàng nào khác đang sử dụng hệ thống.

### Bước 3: Xác nhận thành công trên VPS
Chạy lệnh kiểm tra các container đang hoạt động:
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```
*Chỉ cho họ xem:* Container `crc_app_khtest` đang chạy biệt lập trên cổng `5099`.

Kiểm tra cơ sở dữ liệu đã được tạo riêng:
```bash
docker exec -it crc_db_standalone psql -U crc_user -d postgres -c "\l"
```
*Chỉ cho họ xem:* Database `crc_db_khtest` nằm trong danh sách DB của Postgres và hoàn toàn tách biệt với DB của các khách hàng khác.

### Bước 4: Kiểm tra trên trình duyệt
Mở trình duyệt và truy cập: `https://khtest.yourdomain.com`
*Chỉ cho họ xem:* Trang đăng nhập của khách hàng mới đã sẵn sàng hoạt động với chứng chỉ bảo mật HTTPS (SSL/TLS) hợp lệ và cơ sở dữ liệu hoàn toàn trống (sẵn sàng cho khách hàng nhập liệu).

---

## PHẦN 2: CHỨNG MINH KIẾN TRÚC BẢO MẬT ĐANG CÓ (SECURITY AUDIT SHOWCASE)

Hãy giải thích kiến trúc bảo mật của hệ thống theo 4 lớp từ ngoài vào trong:

### Lớp 1: Bảo mật mạng & Cổng kết nối (Network & Reverse Proxy)
*   **Chỉ mở các cổng tối thiểu (Firewall):** Show trạng thái tường lửa của VPS:
    ```bash
    sudo ufw status
    ```
    *Giải thích:* Chỉ mở cổng SSH (để quản trị) và cổng `80/443` (HTTP/HTTPS) cho người dùng truy cập. Tất cả các cổng chạy ứng dụng của từng khách hàng (`5001`, `5002`, `5099`...) và cổng database (`5432`) đều được **chặn hoàn toàn** từ bên ngoài.
*   **Enforce HTTPS (SSL/TLS):** Show cấu hình Nginx của một khách hàng:
    ```bash
    cat /etc/nginx/sites-enabled/khtest.yourdomain.com.conf
    ```
    *Giải thích:* Mọi yêu cầu HTTP (cổng 80) đều tự động chuyển hướng (Redirect 301) sang HTTPS (cổng 443) sử dụng TLS v1.2/v1.3 với thuật toán mã hóa mạnh.

### Lớp 2: Cô lập tài nguyên giữa các khách hàng (Container & Database Isolation)
*   **Database per Tenant (Cách ly dữ liệu tuyệt đối):** Mỗi khách hàng có một cơ sở dữ liệu riêng. Không có chuyện dữ liệu của Khách hàng A bị lẫn sang Khách hàng B do lỗi logic code (SQL Injection hay nhầm ID).
*   **Cô lập Container (Docker Isolation):** 
    Show các biến môi trường của container để chứng minh mỗi container được cấp một chuỗi bí mật JWT khác nhau và thông tin đăng nhập DB khác nhau:
    ```bash
    docker inspect crc_app_khtest | grep -A 10 "Env"
    ```
    *Giải thích:* Chuỗi `JWT_SECRET` được tự động sinh ngẫu nhiên 24 ký tự hexa (`openssl rand -hex 12`) cho mỗi khách hàng khi khởi tạo. Token đăng nhập của khách hàng này không thể dùng để giải mã hoặc truy cập trái phép vào dữ liệu của khách hàng khác.

### Lớp 3: Bảo mật mức Ứng dụng (Application-level Security)
Hãy mở code server (`server/index.js` hoặc cấu hình tương tự) để giải thích cách bạn bảo vệ API:
1. **Chống Brute-Force đăng nhập (Rate Limiting):**
   *   Show cấu hình `express-rate-limit` trong file `server/index.js`:
       *   Giới hạn đăng nhập: tối đa 15 yêu cầu trong 15 phút trên mỗi IP.
       *   Giới hạn dev login: tối đa 10 yêu cầu trong 15 phút.
   *   *Ý nghĩa:* Ngăn chặn kẻ tấn công dò quét mật khẩu tự động.
2. **Xác thực JWT nghiêm ngặt (Strict Token Verification):**
   *   Mọi API (ngoại trừ luồng đăng nhập công khai) đều đi qua middleware `authenticate`.
   *   Middleware sẽ phân tích header `Authorization: Bearer <Token>`, giải mã bằng `JWT_SECRET` riêng của tenant đó để xác thực danh tính người dùng trước khi truy cập dữ liệu.
3. **Kiểm soát quyền truy cập chi tiết (RBAC - Role-Based Access Control):**
   *   Hệ thống kiểm tra quyền ở cấp Server-side trước khi thực hiện bất kỳ hành động nào (tạo, sửa, xóa, duyệt). Người dùng không có quyền tương ứng sẽ bị API từ chối ngay lập tức với mã lỗi `403 Forbidden`.

### Lớp 4: Sao lưu & Phục hồi dự phòng (Backup & Recovery)
*   Show tiến trình sao lưu định kỳ trên VPS:
    *   Sử dụng Cronjob để tự động backup database hàng ngày.
    *   Các bản backup được nén và lưu trữ an toàn trong thư mục `/root/crc_app/backups/`.
