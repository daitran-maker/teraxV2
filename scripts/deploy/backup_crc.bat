@echo off
setlocal
REM ==========================================
REM CẤU HÌNH THÔNG TIN DATABASE CRC_APP
REM ==========================================
set DB_HOST=localhost
set DB_PORT=9999
set DB_USER=crc_user
set DB_PASS=crc2026
set DB_NAME=crc_db

REM Thư mục lưu backup (Nằm cùng thư mục với script này)
set BACKUP_DIR=%~dp0backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Lấy ngày giờ hiện tại để đặt tên file (Định dạng YYYY-MM-DD)
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set BACKUP_FILE=%BACKUP_DIR%\crc_backup_%mydate%.sql

REM ==========================================
REM THỰC THI LỆNH SAO LƯU (BACKUP)
REM ==========================================
echo Dang tien hanh sao luu database %DB_NAME% vao %BACKUP_FILE%...
set PGPASSWORD=%DB_PASS%

REM Gọi lệnh pg_dump. 
REM (LƯU Ý: Nếu báo lỗi không tìm thấy pg_dump, hãy sửa chữ pg_dump thành đường dẫn chuẩn, 
REM ví dụ: "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe")
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%BACKUP_FILE%"

echo Sao luu hoan tat!

REM ==========================================
REM DỌN DẸP FILE CŨ HƠN 7 NGÀY
REM ==========================================
echo Dang xoa cac ban backup cu hon 7 ngay de giai phong o cung...
forfiles /P "%BACKUP_DIR%" /M *.sql /D -7 /C "cmd /c del @path"

echo DONE!
endlocal
exit /b 0
