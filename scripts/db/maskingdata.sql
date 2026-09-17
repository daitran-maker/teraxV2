-- masking data employee
BEGIN;

-- 01. EMP-1001 - Dương Minh Neo
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Dương Minh Neo', 'Nam', 'Giám đốc Điều hành', 'L5', '1', '669', 'Active', 'EMP-1001', 'Super Admin', 'Hà Nội', 'neo.duong@mps-asia.com', '0901000001', '12 Trần Duy Hưng, Cầu Giấy, Hà Nội', 'Dương Minh Anh', '0911000001', 'BHXH00001001', 'MST00001001', DATE '2020-01-06', '100000001001', 'Vietcombank', 'Hà Nội', 'Điều hành hoạt động chung và phê duyệt các quyết định quản trị.', 'EMP-1001', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1001'
);

-- 02. EMP-1002 - Nguyễn Loan Anh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Nguyễn Loan Anh', 'Nữ', 'Giám đốc Nhân sự', 'L5', '1', '670', 'Active', 'EMP-1002', 'Super Admin', 'Hà Nội', 'loananh.nguyen@mps-asia.com', '0901000002', '25 Nguyễn Chí Thanh, Đống Đa, Hà Nội', 'Nguyễn Văn Thành', '0911000002', 'BHXH00001002', 'MST00001002', DATE '2020-03-16', '100000001002', 'Techcombank', 'Hà Nội', 'Quản lý nhân sự, tuyển dụng, đào tạo và chính sách lao động.', 'EMP-1002', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1002'
);

-- 03. EMP-1003 - Trần Đức Dylan
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Trần Đức Dylan', 'Nam', 'Giám đốc Công nghệ', 'L5', '1', '674', 'Active', 'EMP-1003', 'Super Admin', 'TP. Hồ Chí Minh', 'dylan.tran@mps-asia.com', '0901000003', '68 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh', 'Trần Ngọc Minh', '0911000003', 'BHXH00001003', 'MST00001003', DATE '2020-05-11', '100000001003', 'ACB', 'TP. Hồ Chí Minh', 'Quản lý chiến lược công nghệ, hệ thống và đội ngũ kỹ thuật.', 'EMP-1003', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1003'
);

-- 04. EMP-1004 - Nguyễn Minh Anh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Nguyễn Minh Anh', 'Nữ', 'Kỹ sư Phần mềm', 'Tier 2', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Hà Nội', 'minhanh.nguyen@mps-asia.com', '0901000004', '14 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Nguyễn Văn An', '0911000004', 'BHXH00001004', 'MST00001004', DATE '2021-01-04', '100000001004', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Kỹ sư Phần mềm và báo cáo cho quản lý trực tiếp.', 'EMP-1004', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1004'
);

-- 05. EMP-1005 - Trần Quốc Bảo
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Trần Quốc Bảo', 'Nam', 'Chuyên viên Nhân sự', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'TP. Hồ Chí Minh', 'quocbao.tran@mps-asia.com', '0901000005', '15 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Trần Thị Mai', '0911000005', 'BHXH00001005', 'MST00001005', DATE '2021-01-21', '100000001005', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Chuyên viên Nhân sự và báo cáo cho quản lý trực tiếp.', 'EMP-1005', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1005'
);

-- 06. EMP-1006 - Lê Thu Trang
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Lê Thu Trang', 'Nữ', 'Chuyên viên Kinh doanh', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Đà Nẵng', 'thutrang.le@mps-asia.com', '0901000006', '16 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Nguyễn Văn An', '0911000006', 'BHXH00001006', 'MST00001006', DATE '2021-02-07', '100000001006', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Chuyên viên Kinh doanh và báo cáo cho quản lý trực tiếp.', 'EMP-1006', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1006'
);

-- 07. EMP-1007 - Phạm Hoàng Nam
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Phạm Hoàng Nam', 'Nam', 'Kỹ sư Dữ liệu', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Hải Phòng', 'hoangnam.pham@mps-asia.com', '0901000007', '17 Lạch Tray, Ngô Quyền, Hải Phòng', 'Trần Thị Mai', '0911000007', 'BHXH00001007', 'MST00001007', DATE '2021-02-24', '100000001007', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Kỹ sư Dữ liệu và báo cáo cho quản lý trực tiếp.', 'EMP-1007', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1007'
);

-- 08. EMP-1008 - Hoàng Ngọc Linh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Hoàng Ngọc Linh', 'Nữ', 'Chuyên viên Tuyển dụng', 'Tier 2', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Cần Thơ', 'ngoclinh.hoang@mps-asia.com', '0901000008', '18 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Nguyễn Văn An', '0911000008', 'BHXH00001008', 'MST00001008', DATE '2021-03-13', '100000001008', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Chuyên viên Tuyển dụng và báo cáo cho quản lý trực tiếp.', 'EMP-1008', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1008'
);

-- 09. EMP-1009 - Huỳnh Đức Huy
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Huỳnh Đức Huy', 'Nam', 'Chuyên viên Chăm sóc Khách hàng', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Hà Nội', 'duchuy.huynh@mps-asia.com', '0901000009', '19 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Trần Thị Mai', '0911000009', 'BHXH00001009', 'MST00001009', DATE '2021-03-30', '100000001009', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Chuyên viên Chăm sóc Khách hàng và báo cáo cho quản lý trực tiếp.', 'EMP-1009', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1009'
);

-- 10. EMP-1010 - Phan Gia Hân
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Phan Gia Hân', 'Nữ', 'Kỹ sư Hệ thống', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'TP. Hồ Chí Minh', 'giahan.phan@mps-asia.com', '0901000010', '20 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Nguyễn Văn An', '0911000010', 'BHXH00001010', 'MST00001010', DATE '2021-04-16', '100000001010', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Kỹ sư Hệ thống và báo cáo cho quản lý trực tiếp.', 'EMP-1010', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1010'
);

-- 11. EMP-1011 - Vũ Thanh Tùng
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Vũ Thanh Tùng', 'Nam', 'Chuyên viên C&B', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Đà Nẵng', 'thanhtung.vu@mps-asia.com', '0901000011', '21 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Trần Thị Mai', '0911000011', 'BHXH00001011', 'MST00001011', DATE '2021-05-03', '100000001011', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Chuyên viên C&B và báo cáo cho quản lý trực tiếp.', 'EMP-1011', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1011'
);

-- 12. EMP-1012 - Võ Khánh Vy
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Võ Khánh Vy', 'Nữ', 'Chuyên viên Phân tích Nghiệp vụ', 'Tier 2', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Hải Phòng', 'khanhvy.vo@mps-asia.com', '0901000012', '22 Lạch Tray, Ngô Quyền, Hải Phòng', 'Nguyễn Văn An', '0911000012', 'BHXH00001012', 'MST00001012', DATE '2021-05-20', '100000001012', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Chuyên viên Phân tích Nghiệp vụ và báo cáo cho quản lý trực tiếp.', 'EMP-1012', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1012'
);

-- 13. EMP-1013 - Đặng Quang Minh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Đặng Quang Minh', 'Nam', 'Chuyên viên Kiểm thử', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Cần Thơ', 'quangminh.dang@mps-asia.com', '0901000013', '23 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Trần Thị Mai', '0911000013', 'BHXH00001013', 'MST00001013', DATE '2021-06-06', '100000001013', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Chuyên viên Kiểm thử và báo cáo cho quản lý trực tiếp.', 'EMP-1013', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1013'
);

-- 14. EMP-1014 - Bùi Hải Yến
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Bùi Hải Yến', 'Nữ', 'Chuyên viên Hành chính', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Hà Nội', 'haiyen.bui@mps-asia.com', '0901000014', '24 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Nguyễn Văn An', '0911000014', 'BHXH00001014', 'MST00001014', DATE '2021-06-23', '100000001014', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Chuyên viên Hành chính và báo cáo cho quản lý trực tiếp.', 'EMP-1014', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1014'
);

-- 15. EMP-1015 - Đỗ Tuấn Kiệt
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Đỗ Tuấn Kiệt', 'Nam', 'Điều phối viên Dự án', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'TP. Hồ Chí Minh', 'tuankiet.do@mps-asia.com', '0901000015', '25 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Trần Thị Mai', '0911000015', 'BHXH00001015', 'MST00001015', DATE '2021-07-10', '100000001015', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Điều phối viên Dự án và báo cáo cho quản lý trực tiếp.', 'EMP-1015', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1015'
);

-- 16. EMP-1016 - Hồ Mai Phương
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Hồ Mai Phương', 'Nữ', 'Chuyên viên Phân tích Dữ liệu', 'Tier 2', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Đà Nẵng', 'maiphuong.ho@mps-asia.com', '0901000016', '26 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Nguyễn Văn An', '0911000016', 'BHXH00001016', 'MST00001016', DATE '2021-07-27', '100000001016', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Chuyên viên Phân tích Dữ liệu và báo cáo cho quản lý trực tiếp.', 'EMP-1016', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1016'
);

-- 17. EMP-1017 - Ngô Nhật Anh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Ngô Nhật Anh', 'Nam', 'Chuyên viên Đào tạo', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Hải Phòng', 'nhatanh.ngo@mps-asia.com', '0901000017', '27 Lạch Tray, Ngô Quyền, Hải Phòng', 'Trần Thị Mai', '0911000017', 'BHXH00001017', 'MST00001017', DATE '2021-08-13', '100000001017', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Chuyên viên Đào tạo và báo cáo cho quản lý trực tiếp.', 'EMP-1017', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1017'
);

-- 18. EMP-1018 - Dương Thảo My
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Dương Thảo My', 'Nữ', 'Chuyên viên Marketing', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Cần Thơ', 'thaomy.duong@mps-asia.com', '0901000018', '28 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Nguyễn Văn An', '0911000018', 'BHXH00001018', 'MST00001018', DATE '2021-08-30', '100000001018', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Chuyên viên Marketing và báo cáo cho quản lý trực tiếp.', 'EMP-1018', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1018'
);

-- 19. EMP-1019 - Lý Công Thành
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Lý Công Thành', 'Nam', 'Quản trị Cơ sở dữ liệu', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Hà Nội', 'congthanh.ly@mps-asia.com', '0901000019', '29 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Trần Thị Mai', '0911000019', 'BHXH00001019', 'MST00001019', DATE '2021-09-16', '100000001019', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Quản trị Cơ sở dữ liệu và báo cáo cho quản lý trực tiếp.', 'EMP-1019', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1019'
);

-- 20. EMP-1020 - Đinh Bảo Châu
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Đinh Bảo Châu', 'Nữ', 'Chuyên viên Kế toán', 'Tier 2', '1', '670', 'Active', 'EMP-1002', 'Staff', 'TP. Hồ Chí Minh', 'baochau.dinh@mps-asia.com', '0901000020', '30 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Nguyễn Văn An', '0911000020', 'BHXH00001020', 'MST00001020', DATE '2021-10-03', '100000001020', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Chuyên viên Kế toán và báo cáo cho quản lý trực tiếp.', 'EMP-1020', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1020'
);

-- 21. EMP-1021 - Mai Trung Kiên
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Mai Trung Kiên', 'Nam', 'Chuyên viên Mua hàng', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Đà Nẵng', 'trungkien.mai@mps-asia.com', '0901000021', '31 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Trần Thị Mai', '0911000021', 'BHXH00001021', 'MST00001021', DATE '2021-10-20', '100000001021', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Chuyên viên Mua hàng và báo cáo cho quản lý trực tiếp.', 'EMP-1021', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1021'
);

-- 22. EMP-1022 - Tạ Phương Thảo
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Tạ Phương Thảo', 'Nữ', 'Chuyên viên Hỗ trợ Kỹ thuật', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Hải Phòng', 'phuongthao.ta@mps-asia.com', '0901000022', '32 Lạch Tray, Ngô Quyền, Hải Phòng', 'Nguyễn Văn An', '0911000022', 'BHXH00001022', 'MST00001022', DATE '2021-11-06', '100000001022', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Chuyên viên Hỗ trợ Kỹ thuật và báo cáo cho quản lý trực tiếp.', 'EMP-1022', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1022'
);

-- 23. EMP-1023 - Cao Đức Anh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Cao Đức Anh', 'Nam', 'Chuyên viên Tài chính', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Cần Thơ', 'ducanh.cao@mps-asia.com', '0901000023', '33 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Trần Thị Mai', '0911000023', 'BHXH00001023', 'MST00001023', DATE '2021-11-23', '100000001023', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Chuyên viên Tài chính và báo cáo cho quản lý trực tiếp.', 'EMP-1023', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1023'
);

-- 24. EMP-1024 - Chu Minh Khang
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Chu Minh Khang', 'Nam', 'Chuyên viên Pháp chế', 'Tier 2', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Hà Nội', 'minhkhang.chu@mps-asia.com', '0901000024', '34 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Trần Thị Mai', '0911000024', 'BHXH00001024', 'MST00001024', DATE '2021-12-10', '100000001024', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Chuyên viên Pháp chế và báo cáo cho quản lý trực tiếp.', 'EMP-1024', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1024'
);

-- 25. EMP-1025 - Trương Mỹ Duyên
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Trương Mỹ Duyên', 'Nữ', 'Kỹ sư DevOps', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'TP. Hồ Chí Minh', 'myduyen.truong@mps-asia.com', '0901000025', '35 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Nguyễn Văn An', '0911000025', 'BHXH00001025', 'MST00001025', DATE '2021-12-27', '100000001025', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Kỹ sư DevOps và báo cáo cho quản lý trực tiếp.', 'EMP-1025', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1025'
);

-- 26. EMP-1026 - Lương Quốc Việt
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Lương Quốc Việt', 'Nam', 'Điều phối viên Văn phòng', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Đà Nẵng', 'quocviet.luong@mps-asia.com', '0901000026', '36 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Trần Thị Mai', '0911000026', 'BHXH00001026', 'MST00001026', DATE '2022-01-13', '100000001026', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Điều phối viên Văn phòng và báo cáo cho quản lý trực tiếp.', 'EMP-1026', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1026'
);

-- 27. EMP-1027 - Quách Gia Bảo
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Quách Gia Bảo', 'Nam', 'Chuyên viên Vận hành', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Hải Phòng', 'giabao.quach@mps-asia.com', '0901000027', '37 Lạch Tray, Ngô Quyền, Hải Phòng', 'Trần Thị Mai', '0911000027', 'BHXH00001027', 'MST00001027', DATE '2022-01-30', '100000001027', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Chuyên viên Vận hành và báo cáo cho quản lý trực tiếp.', 'EMP-1027', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1027'
);

-- 28. EMP-1028 - Lâm Thu Hà
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Lâm Thu Hà', 'Nữ', 'Kỹ sư Phần mềm', 'Tier 2', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Cần Thơ', 'thuha.lam@mps-asia.com', '0901000028', '38 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Nguyễn Văn An', '0911000028', 'BHXH00001028', 'MST00001028', DATE '2022-02-16', '100000001028', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Kỹ sư Phần mềm và báo cáo cho quản lý trực tiếp.', 'EMP-1028', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1028'
);

-- 29. EMP-1029 - Kiều Anh Tuấn
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Kiều Anh Tuấn', 'Nam', 'Chuyên viên Nhân sự', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Hà Nội', 'anhtuan.kieu@mps-asia.com', '0901000029', '39 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Trần Thị Mai', '0911000029', 'BHXH00001029', 'MST00001029', DATE '2022-03-05', '100000001029', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Chuyên viên Nhân sự và báo cáo cho quản lý trực tiếp.', 'EMP-1029', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1029'
);

-- 30. EMP-1030 - Tôn Nữ Minh Thư
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Tôn Nữ Minh Thư', 'Nữ', 'Chuyên viên Kinh doanh', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'TP. Hồ Chí Minh', 'minhthu.tonnu@mps-asia.com', '0901000030', '40 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Nguyễn Văn An', '0911000030', 'BHXH00001030', 'MST00001030', DATE '2022-03-22', '100000001030', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Chuyên viên Kinh doanh và báo cáo cho quản lý trực tiếp.', 'EMP-1030', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1030'
);

-- 31. EMP-1031 - Triệu Hoàng Long
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Triệu Hoàng Long', 'Nam', 'Kỹ sư Dữ liệu', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Đà Nẵng', 'hoanglong.trieu@mps-asia.com', '0901000031', '41 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Trần Thị Mai', '0911000031', 'BHXH00001031', 'MST00001031', DATE '2022-04-08', '100000001031', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Kỹ sư Dữ liệu và báo cáo cho quản lý trực tiếp.', 'EMP-1031', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1031'
);

-- 32. EMP-1032 - Ninh Ngọc Mai
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Ninh Ngọc Mai', 'Nữ', 'Chuyên viên Tuyển dụng', 'Tier 2', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Hải Phòng', 'ngocmai.ninh@mps-asia.com', '0901000032', '42 Lạch Tray, Ngô Quyền, Hải Phòng', 'Nguyễn Văn An', '0911000032', 'BHXH00001032', 'MST00001032', DATE '2022-04-25', '100000001032', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Chuyên viên Tuyển dụng và báo cáo cho quản lý trực tiếp.', 'EMP-1032', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1032'
);

-- 33. EMP-1033 - Hà Đức Thịnh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Hà Đức Thịnh', 'Nam', 'Chuyên viên Chăm sóc Khách hàng', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Cần Thơ', 'ducthinh.ha@mps-asia.com', '0901000033', '43 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Trần Thị Mai', '0911000033', 'BHXH00001033', 'MST00001033', DATE '2022-05-12', '100000001033', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Chuyên viên Chăm sóc Khách hàng và báo cáo cho quản lý trực tiếp.', 'EMP-1033', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1033'
);

-- 34. EMP-1034 - La Thanh Hương
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'La Thanh Hương', 'Nữ', 'Kỹ sư Hệ thống', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Hà Nội', 'thanhhuong.la@mps-asia.com', '0901000034', '44 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Nguyễn Văn An', '0911000034', 'BHXH00001034', 'MST00001034', DATE '2022-05-29', '100000001034', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Kỹ sư Hệ thống và báo cáo cho quản lý trực tiếp.', 'EMP-1034', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1034'
);

-- 35. EMP-1035 - Thái Minh Đức
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Thái Minh Đức', 'Nam', 'Chuyên viên C&B', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'TP. Hồ Chí Minh', 'minhduc.thai@mps-asia.com', '0901000035', '45 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Trần Thị Mai', '0911000035', 'BHXH00001035', 'MST00001035', DATE '2022-06-15', '100000001035', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Chuyên viên C&B và báo cáo cho quản lý trực tiếp.', 'EMP-1035', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1035'
);

-- 36. EMP-1036 - Châu Bảo Ngọc
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Châu Bảo Ngọc', 'Nữ', 'Chuyên viên Phân tích Nghiệp vụ', 'Tier 2', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Đà Nẵng', 'baongoc.chau@mps-asia.com', '0901000036', '46 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Nguyễn Văn An', '0911000036', 'BHXH00001036', 'MST00001036', DATE '2022-07-02', '100000001036', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Chuyên viên Phân tích Nghiệp vụ và báo cáo cho quản lý trực tiếp.', 'EMP-1036', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1036'
);

-- 37. EMP-1037 - Tăng Quốc Khánh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Tăng Quốc Khánh', 'Nam', 'Chuyên viên Kiểm thử', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Hải Phòng', 'quockhanh.tang@mps-asia.com', '0901000037', '47 Lạch Tray, Ngô Quyền, Hải Phòng', 'Trần Thị Mai', '0911000037', 'BHXH00001037', 'MST00001037', DATE '2022-07-19', '100000001037', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Chuyên viên Kiểm thử và báo cáo cho quản lý trực tiếp.', 'EMP-1037', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1037'
);

-- 38. EMP-1038 - Quản Thị Lan
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Quản Thị Lan', 'Nữ', 'Chuyên viên Hành chính', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Cần Thơ', 'thilan.quan@mps-asia.com', '0901000038', '48 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Nguyễn Văn An', '0911000038', 'BHXH00001038', 'MST00001038', DATE '2022-08-05', '100000001038', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Chuyên viên Hành chính và báo cáo cho quản lý trực tiếp.', 'EMP-1038', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1038'
);

-- 39. EMP-1039 - Mạc Thành Đạt
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Mạc Thành Đạt', 'Nam', 'Điều phối viên Dự án', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Hà Nội', 'thanhdat.mac@mps-asia.com', '0901000039', '49 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Trần Thị Mai', '0911000039', 'BHXH00001039', 'MST00001039', DATE '2022-08-22', '100000001039', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Điều phối viên Dự án và báo cáo cho quản lý trực tiếp.', 'EMP-1039', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1039'
);

-- 40. EMP-1040 - Âu Nhật Minh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Âu Nhật Minh', 'Nam', 'Chuyên viên Phân tích Dữ liệu', 'Tier 2', '1', '674', 'Active', 'EMP-1003', 'Staff', 'TP. Hồ Chí Minh', 'nhatminh.au@mps-asia.com', '0901000040', '50 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Trần Thị Mai', '0911000040', 'BHXH00001040', 'MST00001040', DATE '2022-09-08', '100000001040', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Chuyên viên Phân tích Dữ liệu và báo cáo cho quản lý trực tiếp.', 'EMP-1040', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1040'
);

-- 41. EMP-1041 - Tô Hải Nam
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Tô Hải Nam', 'Nam', 'Chuyên viên Đào tạo', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Đà Nẵng', 'hainam.to@mps-asia.com', '0901000041', '51 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Trần Thị Mai', '0911000041', 'BHXH00001041', 'MST00001041', DATE '2022-09-25', '100000001041', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Chuyên viên Đào tạo và báo cáo cho quản lý trực tiếp.', 'EMP-1041', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1041'
);

-- 42. EMP-1042 - Sơn Ngọc Anh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Sơn Ngọc Anh', 'Nữ', 'Chuyên viên Marketing', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Hải Phòng', 'ngocanh.son@mps-asia.com', '0901000042', '52 Lạch Tray, Ngô Quyền, Hải Phòng', 'Nguyễn Văn An', '0911000042', 'BHXH00001042', 'MST00001042', DATE '2022-10-12', '100000001042', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Chuyên viên Marketing và báo cáo cho quản lý trực tiếp.', 'EMP-1042', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1042'
);

-- 43. EMP-1043 - Thạch Quang Huy
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Thạch Quang Huy', 'Nam', 'Quản trị Cơ sở dữ liệu', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Cần Thơ', 'quanghuy.thach@mps-asia.com', '0901000043', '53 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Trần Thị Mai', '0911000043', 'BHXH00001043', 'MST00001043', DATE '2022-10-29', '100000001043', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Quản trị Cơ sở dữ liệu và báo cáo cho quản lý trực tiếp.', 'EMP-1043', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1043'
);

-- 44. EMP-1044 - Diệp Thanh Trúc
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Diệp Thanh Trúc', 'Nữ', 'Chuyên viên Kế toán', 'Tier 2', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Hà Nội', 'thanhtruc.diep@mps-asia.com', '0901000044', '54 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Nguyễn Văn An', '0911000044', 'BHXH00001044', 'MST00001044', DATE '2022-11-15', '100000001044', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Chuyên viên Kế toán và báo cáo cho quản lý trực tiếp.', 'EMP-1044', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1044'
);

-- 45. EMP-1045 - Hứa Minh Tâm
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Hứa Minh Tâm', 'Nam', 'Chuyên viên Mua hàng', 'Tier 1', '1', '669', 'Active', 'EMP-1001', 'Staff', 'TP. Hồ Chí Minh', 'minhtam.hua@mps-asia.com', '0901000045', '55 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Trần Thị Mai', '0911000045', 'BHXH00001045', 'MST00001045', DATE '2022-12-02', '100000001045', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Chuyên viên Mua hàng và báo cáo cho quản lý trực tiếp.', 'EMP-1045', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1045'
);

-- 46. EMP-1046 - Khổng Bích Ngọc
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Khổng Bích Ngọc', 'Nữ', 'Chuyên viên Hỗ trợ Kỹ thuật', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Đà Nẵng', 'bichngoc.khong@mps-asia.com', '0901000046', '56 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 'Nguyễn Văn An', '0911000046', 'BHXH00001046', 'MST00001046', DATE '2022-12-19', '100000001046', 'BIDV', 'Đà Nẵng', 'Thực hiện công việc của vị trí Chuyên viên Hỗ trợ Kỹ thuật và báo cáo cho quản lý trực tiếp.', 'EMP-1046', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1046'
);

-- 47. EMP-1047 - Trịnh Quốc Dũng
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Trịnh Quốc Dũng', 'Nam', 'Chuyên viên Tài chính', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'Hải Phòng', 'quocdung.trinh@mps-asia.com', '0901000047', '57 Lạch Tray, Ngô Quyền, Hải Phòng', 'Trần Thị Mai', '0911000047', 'BHXH00001047', 'MST00001047', DATE '2023-01-05', '100000001047', 'VietinBank', 'Hải Phòng', 'Thực hiện công việc của vị trí Chuyên viên Tài chính và báo cáo cho quản lý trực tiếp.', 'EMP-1047', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1047'
);

-- 48. EMP-1048 - Nguyễn Hà Giang
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Nguyễn Hà Giang', 'Nữ', 'Chuyên viên Pháp chế', 'Tier 2', '1', '669', 'Active', 'EMP-1001', 'Staff', 'Cần Thơ', 'hagiang.nguyen@mps-asia.com', '0901000048', '58 Đường 30 Tháng 4, Ninh Kiều, Cần Thơ', 'Nguyễn Văn An', '0911000048', 'BHXH00001048', 'MST00001048', DATE '2023-01-22', '100000001048', 'ACB', 'Cần Thơ', 'Thực hiện công việc của vị trí Chuyên viên Pháp chế và báo cáo cho quản lý trực tiếp.', 'EMP-1048', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1048'
);

-- 49. EMP-1049 - Trần Minh Quân
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Trần Minh Quân', 'Nam', 'Kỹ sư DevOps', 'Tier 1', '1', '674', 'Active', 'EMP-1003', 'Staff', 'Hà Nội', 'minhquan.tran@mps-asia.com', '0901000049', '59 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Trần Thị Mai', '0911000049', 'BHXH00001049', 'MST00001049', DATE '2023-02-08', '100000001049', 'Vietcombank', 'Hà Nội', 'Thực hiện công việc của vị trí Kỹ sư DevOps và báo cáo cho quản lý trực tiếp.', 'EMP-1049', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1049'
);

-- 50. EMP-1050 - Lê Kim Oanh
INSERT INTO public.employee (
    full_name, gen, "position", employee_level, company_id, department_id,
    status, direct_manager, role, location_base, email,
    phone, address, emergency_contact_name, emergency_contact_phone,
    social_insurance_code, pit_code, start_date, bank_account,
    bank_name, bank_city, sow, independent_id, created_by, created_date, log
)
VALUES (
    'Lê Kim Oanh', 'Nữ', 'Điều phối viên Văn phòng', 'Tier 1', '1', '670', 'Active', 'EMP-1002', 'Staff', 'TP. Hồ Chí Minh', 'kimoanh.le@mps-asia.com', '0901000050', '60 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', 'Nguyễn Văn An', '0911000050', 'BHXH00001050', 'MST00001050', DATE '2023-02-25', '100000001050', 'Techcombank', 'TP. Hồ Chí Minh', 'Thực hiện công việc của vị trí Điều phối viên Văn phòng và báo cáo cho quản lý trực tiếp.', 'EMP-1050', 'seed_data_vi_50', NOW(), 'Dữ liệu giả tiếng Việt - nhân viên EMP-1050'
);

COMMIT;




-- Import data của bảng finance 
SET client_encoding = 'UTF8';

BEGIN;

INSERT INTO public.finance (
    finance_account_number,
    finance_account_name,
    finance_type,
    english_name,
    description,
    example,
    status,
    department,
    finance_account_standard,
    operation_type
)
VALUES
    ('111', 'Tiền mặt', 'Dư Nợ', 'Cash in hand', 'Quản lý tiền mặt của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1111', 'Tiền Việt Nam', 'Dư Nợ', 'Vietnam dong', 'Quản lý tiền việt nam của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1112', 'Ngoại tệ', 'Dư Nợ', 'Foreign currency', 'Quản lý ngoại tệ của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1113', 'Vàng tiền tệ', 'Dư Nợ', 'Monetary gold', 'Quản lý vàng tiền tệ của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('112', 'Tiền gửi không kỳ hạn', 'Dư Nợ', 'Demand Deposits (Cash at Bank – non-term)', 'Quản lý tiền gửi không kỳ hạn của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1121', 'Tiền Việt Nam', 'Dư Nợ', 'Vietnam dong', 'Quản lý tiền việt nam của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('11211', 'Tiền gửi TK Techcombank', 'Dư Nợ', 'Vietnam dong', 'Quản lý tiền gửi tk techcombank của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('11212', 'Tiền gửi TK VPBank', 'Dư Nợ', 'Vietnam dong', 'Quản lý tiền gửi tk vpbank của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('11213', 'Tiền gửi TK TCBS', 'Dư Nợ', 'Vietnam dong', 'Quản lý tiền gửi tk tcbs của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('11214', 'Tiền gửi TK BIDV', 'Dư Nợ', 'Vietnam dong', 'Quản lý tiền gửi tk bidv của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1122', 'Ngoại tệ', 'Dư Nợ', 'Foreign currency', 'Quản lý ngoại tệ của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('11221', 'Tiền gửi TK Techcombank - USD', 'Dư Nợ', 'Foreign currency', 'Quản lý tiền gửi tk techcombank - usd của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('11222', 'Tiền gửi TK BIDV - USD', 'Dư Nợ', 'Foreign currency', 'Quản lý tiền gửi tk bidv - usd của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1123', 'Vàng tiền tệ', 'Dư Nợ', 'Monetary gold', 'Quản lý vàng tiền tệ của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('113', 'Tiền đang chuyển', 'Dư Nợ', 'Cash in transit', 'Quản lý tiền đang chuyển của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1131', 'Tiền Việt Nam', 'Dư Nợ', 'Vietnam dong', 'Quản lý tiền việt nam của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1132', 'Ngoại tệ', 'Dư Nợ', 'Foreign currency', 'Quản lý ngoại tệ của doanh nghiệp.', 'Thu tiền khách hàng, thanh toán nhà cung cấp hoặc chuyển khoản.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('121', 'Chứng khoán kinh doanh', 'Dư Nợ', 'Securities trading', 'Ghi nhận chứng khoán kinh doanh của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('1211', 'Cổ phiếu', 'Dư Nợ', 'Stocks', 'Ghi nhận cổ phiếu của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('1212', 'Trái phiếu', 'Dư Nợ', 'Bonds', 'Ghi nhận trái phiếu của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('1218', 'Chứng khoán và công cụ tài chính khác', 'Dư Nợ', 'Securities and other financial instruments', 'Ghi nhận chứng khoán và công cụ tài chính khác của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('128', 'Đầu tư nắm giữ đến ngày đáo hạn', 'Dư Nợ', 'Other short - term investment', 'Ghi nhận đầu tư nắm giữ đến ngày đáo hạn của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('1281', 'Tiền gửi có kỳ hạn', 'Dư Nợ', 'Term deposits', 'Ghi nhận tiền gửi có kỳ hạn của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('1282', 'Trái phiếu', 'Dư Nợ', 'Bonds', 'Ghi nhận trái phiếu của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('1283', 'Cho vay', 'Dư Nợ', 'Loan', 'Ghi nhận cho vay của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('1288', 'Các khoản đầu tư khác nắm giữ đến ngày đáo hạn', 'Dư Nợ', 'Other short - term investment', 'Ghi nhận các khoản đầu tư khác nắm giữ đến ngày đáo hạn của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Đầu tư'),
    ('131', 'Phải thu của khách hàng', 'Lưỡng tính', 'Receivables from customers', 'Ghi nhận phải thu của khách hàng.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('133', 'Thuế GTGT được khấu trừ', 'Dư Nợ', 'VAT deducted', 'Ghi nhận thuế gtgt được khấu trừ.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1331', 'Thuế GTGT được khấu trừ của HH, DV', 'Dư Nợ', NULL, 'Ghi nhận thuế gtgt được khấu trừ của hh, dv.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1332', 'Thuế GTGT được khấu trừ của HH, DV bán ra chịu thuế', 'Dư Nợ', NULL, 'Ghi nhận thuế gtgt được khấu trừ của hh, dv bán ra chịu thuế.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1333', 'Thuế GTGT được khấu trừ của HH, DV bán ra không chịu thuế', 'Dư Nợ', NULL, 'Ghi nhận thuế gtgt được khấu trừ của hh, dv bán ra không chịu thuế.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('136', 'Phải thu nội bộ', 'Dư Nợ', 'Intercompany receivable', 'Ghi nhận phải thu nội bộ.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1361', 'Vốn kinh doanh ở các đơn vị trực thuộc', 'Dư Nợ', 'Investment in equity of subsidiaries', 'Ghi nhận vốn kinh doanh ở các đơn vị trực thuộc.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1362', 'Phải thu nội bộ về chênh lệch tỷ giá', 'Dư Nợ', 'Internal receivable on rate differences', 'Ghi nhận phải thu nội bộ về chênh lệch tỷ giá.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1363', 'Phải thu nội bộ về chi phí đi vay đủ điều kiện được vốn hóa', 'Dư Nợ', 'Internal receivable the borrowing costs eligible for capitalization', 'Ghi nhận phải thu nội bộ về chi phí đi vay đủ điều kiện được vốn hóa.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1368', 'Phải thu nội bộ khác', 'Dư Nợ', 'Other receivable from subsidiaries', 'Ghi nhận phải thu nội bộ khác.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('138', 'Phải thu khác', 'Lưỡng tính', 'Other receivable', 'Ghi nhận phải thu khác.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1381', 'Tài sản thiếu chờ xử lý', 'Lưỡng tính', 'Shortage of assets awaiting resolution', 'Ghi nhận tài sản thiếu chờ xử lý.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1383', 'Thuế TTĐB của hàng nhập khẩu', 'Dư Nợ', 'Excise Tax on Imported Goods', 'Ghi nhận thuế ttđb của hàng nhập khẩu.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1385', 'Phải thu về cổ phần hóa', 'Lưỡng tính', 'Equitization receivable', 'Ghi nhận phải thu về cổ phần hóa.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1388', 'Phải thu khác', 'Lưỡng tính', 'Other receivable', 'Ghi nhận phải thu khác.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('141', 'Tạm ứng', 'Dư Nợ', 'Advances', 'Ghi nhận tạm ứng.', 'Công nợ khách hàng, tạm ứng kỹ sư hoặc khoản phải thu khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('151', 'Hàng mua đang đi đường', 'Dư Nợ', 'Goods in transit', 'Quản lý hàng mua đang đi đường.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('152', 'Nguyên liệu, vật liệu', 'Dư Nợ', 'Raw materials', 'Quản lý nguyên liệu, vật liệu.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('153', 'Công cụ, dụng cụ', 'Dư Nợ', 'Tools and supplies', 'Quản lý công cụ, dụng cụ.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1531', 'Công cụ, dụng cụ', 'Dư Nợ', 'Tools and supplies', 'Quản lý công cụ, dụng cụ.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1532', 'Bao bì luân chuyển', 'Dư Nợ', 'Packaging rotation', 'Quản lý bao bì luân chuyển.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1533', 'Đồ dùng cho thuê', 'Dư Nợ', 'Tools for rent', 'Quản lý đồ dùng cho thuê.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1534', 'Thiết bị, phụ tùng thay thế', 'Dư Nợ', 'Equipment spare parts', 'Quản lý thiết bị, phụ tùng thay thế.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('154', 'Chi phí sản xuất, kinh doanh dở dang', 'Dư Nợ', 'Work in progress', 'Quản lý chi phí sản xuất, kinh doanh dở dang.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('155', 'Sản phẩm', 'Dư Nợ', 'Product', 'Quản lý sản phẩm.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1551', 'Thành phẩm nhập kho', 'Dư Nợ', 'Finished goods', 'Quản lý thành phẩm nhập kho.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1557', 'Thành phẩm bất động sản', 'Dư Nợ', 'Finished real Estate', 'Quản lý thành phẩm bất động sản.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('156', 'Hàng hóa', 'Dư Nợ', 'Merchandise inventory', 'Quản lý hàng hóa.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1561', 'Giá mua hàng hóa', 'Dư Nợ', 'Price of goods', 'Quản lý giá mua hàng hóa.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1562', 'Chi phí thu mua hàng hóa', 'Dư Nợ', 'Purchasing expense', 'Quản lý chi phí thu mua hàng hóa.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('1567', 'Hàng hóa bất động sản', 'Dư Nợ', 'Real Estate', 'Quản lý hàng hóa bất động sản.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('157', 'Hàng gửi đi bán', 'Dư Nợ', 'Goods on consignment', 'Quản lý hàng gửi đi bán.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('158', 'Nguyên liệu, vật tư tại kho bảo thuế', 'Dư Nợ', 'Materials and Supplies in Bonded Warehouses', 'Quản lý nguyên liệu, vật tư tại kho bảo thuế.', 'Thiết bị máy tính, máy chủ, thiết bị lưu trữu, linh kiện, hàng tồn hoặc chi phí dự án.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('171', 'Giao dịch mua bán lại trái phiếu chính phủ', 'Lưỡng tính', 'Traded purchase and resell government bonds', 'Ghi nhận giao dịch mua bán lại trái phiếu chính phủ.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('211', 'Tài sản cố định hữu hình', 'Dư Nợ', 'Tangible fixed assets', 'Ghi nhận tài sản cố định hữu hình.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2111', 'Nhà cửa, vật kiến trúc', 'Dư Nợ', 'Houses and architectural', 'Ghi nhận nhà cửa, vật kiến trúc.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2112', 'Máy móc, thiết bị', 'Dư Nợ', 'Equipment & machines', 'Ghi nhận máy móc, thiết bị.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2113', 'Phương tiện vận tải, truyền dẫn', 'Dư Nợ', 'Means of transport, conveyance equipment', 'Ghi nhận phương tiện vận tải, truyền dẫn.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2114', 'Thiết bị, dụng cụ quản lý', 'Dư Nợ', 'Managerial equipment and instruments', 'Ghi nhận thiết bị, dụng cụ quản lý.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2115', 'Cây lâu năm, súc vật làm việc và cho sản phẩm', 'Dư Nợ', 'Long term trees, working & killed animals', 'Ghi nhận cây lâu năm, súc vật làm việc và cho sản phẩm.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2118', 'TSCĐ khác', 'Dư Nợ', 'Other tangible fixed assets', 'Ghi nhận tscđ khác.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('212', 'Tài sản cố định thuê tài chính', 'Dư Nợ', 'Financial leasing fixed assets', 'Ghi nhận tài sản cố định thuê tài chính.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2121', 'TSCĐ hữu hình thuê tài chính', 'Dư Nợ', 'Tangible financial leasing fixed assets', 'Ghi nhận tscđ hữu hình thuê tài chính.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2122', 'TSCĐ vô hình thuê tài chính', 'Dư Nợ', 'Intangible financial leasing fixed assets', 'Ghi nhận tscđ vô hình thuê tài chính.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('213', 'Tài sản cố định vô hình', 'Dư Nợ', 'Intangible fixed assets', 'Ghi nhận tài sản cố định vô hình.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2131', 'Quyền sử dụng đất', 'Dư Nợ', 'Land using right', 'Ghi nhận quyền sử dụng đất.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2132', 'Quyền phát hành', 'Dư Nợ', 'Distribution rights', 'Ghi nhận quyền phát hành.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2133', 'Bản quyền, bằng sáng chế', 'Dư Nợ', 'Copyright, patents', 'Ghi nhận bản quyền, bằng sáng chế.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2134', 'Nhãn hiệu, tên thương mại', 'Dư Nợ', 'Trademark', 'Ghi nhận nhãn hiệu, tên thương mại.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2135', 'Chương trình phần mềm', 'Dư Nợ', 'Software', 'Ghi nhận chương trình phần mềm.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2136', 'Giấy phép và giấy phép nhượng quyền', 'Dư Nợ', 'License and right concession permits', 'Ghi nhận giấy phép và giấy phép nhượng quyền.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2138', 'TSCĐ vô hình khác', 'Dư Nợ', 'Other intangible fixed assets', 'Ghi nhận tscđ vô hình khác.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('214', 'Hao mòn tài sản cố định', 'Dư Có', 'Depreciation of fixed assets', 'Ghi nhận hao mòn tài sản cố định.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2141', 'Hao mòn TSCĐ hữu hình', 'Dư Có', 'Tangible fixed assets depreciation', 'Ghi nhận hao mòn tscđ hữu hình.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2142', 'Hao mòn TSCĐ thuê tài chính', 'Dư Có', 'Financial leasing fixed assets depreciation', 'Ghi nhận hao mòn tscđ thuê tài chính.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2143', 'Hao mòn TSCĐ vô hình', 'Dư Có', 'Intangible fixed assets depreciation', 'Ghi nhận hao mòn tscđ vô hình.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2147', 'Hao mòn bất động sản đầu tư', 'Dư Có', 'Investment real estate depreciation', 'Ghi nhận hao mòn bất động sản đầu tư.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('215', 'Tài sản sinh học', 'Dư Nợ', 'Biological Assets', 'Ghi nhận tài sản sinh học.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2151', 'Súc vật nuôi cho sản phẩm định kỳ', 'Dư Nợ', 'Breeding Animals – Recurring Production', 'Ghi nhận súc vật nuôi cho sản phẩm định kỳ.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('21511', 'Súc vật nuôi cho sản phẩm định kỳ chưa đạt đến giai đoạn trưởng thành', 'Dư Nợ', 'Immature Breeding Animals – Recurring Production', 'Ghi nhận súc vật nuôi cho sản phẩm định kỳ chưa đạt đến giai đoạn trưởng thành.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('21512', 'Súc vật nuôi cho sản phẩm định kỳ đạt đến giai đoạn trưởng thành', 'Dư Nợ', 'Mature Breeding Animals – Recurring Production', 'Ghi nhận súc vật nuôi cho sản phẩm định kỳ đạt đến giai đoạn trưởng thành.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('215121', 'Nguyên giá', 'Dư Nợ', 'Original Cost', 'Ghi nhận nguyên giá.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('215122', 'Giá trị khấu hao lũy kế', 'Dư Có', 'Accumulated Depreciation', 'Ghi nhận giá trị khấu hao lũy kế.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2152', 'Súc vật nuôi lấy sản phẩm một lần', 'Dư Nợ', 'Breeding Animals – One-off Production', 'Ghi nhận súc vật nuôi lấy sản phẩm một lần.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2153', 'Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần', 'Dư Nợ', 'Seasonal Crops or One-off Harvest Plants', 'Ghi nhận cây trồng theo mùa vụ hoặc lấy sản phẩm một lần.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('217', 'Bất động sản đầu tư', 'Dư Nợ', 'Investment real estate', 'Ghi nhận bất động sản đầu tư.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('221', 'Đầu tư vào công ty con', 'Dư Nợ', 'Investment in equity of subsidiaries', 'Ghi nhận đầu tư vào công ty con của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('222', 'Đầu tư vào công ty liên doanh, liên kết', 'Dư Nợ', 'Joint venture capital contribution', 'Ghi nhận đầu tư vào công ty liên doanh, liên kết của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('228', 'Đầu tư khác', 'Dư Nợ', 'Other long term investments', 'Ghi nhận đầu tư khác của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2281', 'Đầu tư góp vốn vào đơn vị khác', 'Dư Nợ', 'Stocks', 'Ghi nhận đầu tư góp vốn vào đơn vị khác của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2288', 'Đầu tư khác', 'Dư Nợ', 'Other long-term investment', 'Ghi nhận đầu tư khác của doanh nghiệp.', 'Đầu tư cổ phiếu, trái phiếu, CCTG, góp vốn hoặc cho vay.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('229', 'Dự phòng tổn thất tài sản', 'Dư Có', 'Provision for assets', 'Ghi nhận dự phòng tổn thất tài sản.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2291', 'Dự phòng giảm giá chứng khoán kinh doanh', 'Dư Có', 'Provision for the diminution in value of short-term investments', 'Ghi nhận dự phòng giảm giá chứng khoán kinh doanh.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2292', 'Dự phòng tổn thất đầu tư vào đơn vị khác', 'Dư Có', 'Provision for decline in long term investments', 'Ghi nhận dự phòng tổn thất đầu tư vào đơn vị khác.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán');

INSERT INTO public.finance (
    finance_account_number,
    finance_account_name,
    finance_type,
    english_name,
    description,
    example,
    status,
    department,
    finance_account_standard,
    operation_type
)
VALUES
    ('2293', 'Dự phòng phải thu khó đòi', 'Dư Có', 'Provision for bad debts', 'Ghi nhận dự phòng phải thu khó đòi.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2294', 'Dự phòng giảm giá hàng tồn kho', 'Dư Có', 'Provision for decline in inventory', 'Ghi nhận dự phòng giảm giá hàng tồn kho.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2295', 'Dự phòng tổn thất tài sản sinh học', 'Dư Có', 'Provision for Biological Asset Impairment', 'Ghi nhận dự phòng tổn thất tài sản sinh học.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('241', 'Xây dựng cơ bản dở dang', 'Dư Nợ', 'Construction in process', 'Ghi nhận xây dựng cơ bản dở dang.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2411', 'Mua sắm TSCĐ', 'Dư Nợ', 'Fixed assets purchases', 'Ghi nhận mua sắm tscđ.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2412', 'Xây dựng cơ bản', 'Dư Nợ', 'Construction in process', 'Ghi nhận xây dựng cơ bản.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2413', 'Sửa chữa, bảo dưỡng định kỳ TSCĐ', 'Dư Nợ', 'Regular Repairs and Maintenance of Fixed Assets', 'Ghi nhận sửa chữa, bảo dưỡng định kỳ tscđ.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('2414', 'Nâng cấp, cải tạo TSCĐ', 'Dư Nợ', 'Upgrade and Renovate Fixed Assets', 'Ghi nhận nâng cấp, cải tạo tscđ.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('242', 'Chi phí chờ phân bổ', 'Dư Nợ', 'Accrued Expenses', 'Ghi nhận chi phí chờ phân bổ.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('243', 'Tài sản thuế thu nhập hoãn lại', 'Dư Nợ', 'Deffered income tax assets', 'Ghi nhận tài sản thuế thu nhập hoãn lại.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('244', 'Ký quỹ, ký cược', 'Dư Nợ', 'Deposits and Pledges', 'Ghi nhận ký quỹ, ký cược.', 'Máy chủ, thiết bị lab, phần mềm nội bộ, tài sản cố định hoặc chi phí trả trước.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('331', 'Phải trả cho người bán', 'Lưỡng tính', 'Payable to seller', 'Ghi nhận phải trả cho người bán.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('332', 'Phải trả cổ tức, lợi nhuận', 'Dư Có', 'Dividends and Profits Payable', 'Ghi nhận phải trả cổ tức, lợi nhuận.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('333', 'Thuế và các khoản phải nộp Nhà nước', 'Lưỡng tính', 'Taxes and payable to state budget', 'Ghi nhận thuế và các khoản phải nộp nhà nước.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3331', 'Thuế giá trị gia tăng phải nộp', 'Lưỡng tính', 'Value Added Tax', 'Ghi nhận thuế giá trị gia tăng phải nộp.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('33311', 'Thuế GTGT đầu ra', 'Lưỡng tính', 'VAT output', 'Ghi nhận thuế gtgt đầu ra.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('33312', 'Thuế GTGT hàng nhập khẩu', 'Lưỡng tính', 'VAT for imported goods', 'Ghi nhận thuế gtgt hàng nhập khẩu.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3332', 'Thuế tiêu thụ đặc biệt', 'Lưỡng tính', 'Special consumption tax', 'Ghi nhận thuế tiêu thụ đặc biệt.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3333', 'Thuế xuất, nhập khẩu', 'Lưỡng tính', 'Import & export duties', 'Ghi nhận thuế xuất, nhập khẩu.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3334', 'Thuế thu nhập doanh nghiệp', 'Lưỡng tính', 'Profit tax', 'Ghi nhận thuế thu nhập doanh nghiệp.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3335', 'Thuế thu nhập cá nhân', 'Lưỡng tính', 'Personal income tax', 'Ghi nhận thuế thu nhập cá nhân.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3336', 'Thuế tài nguyên', 'Lưỡng tính', 'Natural resource tax', 'Ghi nhận thuế tài nguyên.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3337', 'Thuế nhà đất, tiền thuê đất', 'Lưỡng tính', 'Land & housing tax, land rental charges', 'Ghi nhận thuế nhà đất, tiền thuê đất.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3338', 'Thuế bảo vệ môi trường và các loại thuế khác', 'Lưỡng tính', 'Invironmental protection tax and other taxes', 'Ghi nhận thuế bảo vệ môi trường và các loại thuế khác.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('33381', 'Thuế bảo vệ môi trường', 'Lưỡng tính', 'Invironmental protection tax', 'Ghi nhận thuế bảo vệ môi trường.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('33382', 'Các loại thuế khác', 'Lưỡng tính', 'Other taxes', 'Ghi nhận các loại thuế khác.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3339', 'Phí, lệ phí và các khoản phải nộp khác', 'Lưỡng tính', 'Fee & charge & other payables', 'Ghi nhận phí, lệ phí và các khoản phải nộp khác.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('334', 'Phải trả người lao động', 'Dư Có', 'Payable to employees', 'Ghi nhận phải trả người lao động.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3341', 'Phải trả công nhân viên', 'Dư Có', 'Payable to employees', 'Ghi nhận phải trả công nhân viên.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3348', 'Phải trả người lao động khác', 'Dư Có', 'Payable to other employees', 'Ghi nhận phải trả người lao động khác.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('335', 'Chi phí phải trả', 'Dư Có', 'Accruals', 'Ghi nhận chi phí phải trả.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('336', 'Phải trả nội bộ', 'Dư Có', 'Intercompany payable', 'Ghi nhận phải trả nội bộ.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3361', 'Phải trả nội bộ về vốn kinh doanh', 'Dư Có', 'Internal payable on capital', 'Ghi nhận phải trả nội bộ về vốn kinh doanh.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3362', 'Phải trả nội bộ về chênh lệch tỷ giá', 'Dư Có', 'Internal payable on rate differences', 'Ghi nhận phải trả nội bộ về chênh lệch tỷ giá.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3363', 'Phải trả nội bộ về chi phí đi vay đủ điều kiện được vốn hóa', 'Dư Có', 'Internal pay the borrowing costs eligible for capitalization', 'Ghi nhận phải trả nội bộ về chi phí đi vay đủ điều kiện được vốn hóa.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3368', 'Phải trả nội bộ khác', 'Dư Có', 'Other internal payable', 'Ghi nhận phải trả nội bộ khác.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('337', 'Thanh toán theo tiến độ hợp đồng xây dựng', 'Lưỡng tính', 'Construction contract progress payment due to customers', 'Ghi nhận thanh toán theo tiến độ hợp đồng xây dựng.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('338', 'Phải trả, phải nộp khác', 'Lưỡng tính', 'Other payable', 'Ghi nhận phải trả, phải nộp khác.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3381', 'Tài sản thừa chờ giải quyết', 'Lưỡng tính', 'Surplus assets awaiting for resolution', 'Ghi nhận tài sản thừa chờ giải quyết.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3382', 'Kinh phí công đoàn', 'Lưỡng tính', 'Trade Union fees', 'Ghi nhận kinh phí công đoàn.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3383', 'Bảo hiểm xã hội', 'Lưỡng tính', 'Social insurance', 'Ghi nhận bảo hiểm xã hội.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3384', 'Bảo hiểm y tế', 'Lưỡng tính', 'Health insurance', 'Ghi nhận bảo hiểm y tế.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3386', 'Bảo hiểm thất nghiệp', 'Lưỡng tính', 'Unemployment insurance', 'Ghi nhận bảo hiểm thất nghiệp.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3387', 'Doanh thu chờ phân bổ', 'Lưỡng tính', 'Deferred Revenue', 'Ghi nhận doanh thu chờ phân bổ.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3388', 'Phải trả, phải nộp khác', 'Lưỡng tính', 'Other payable', 'Ghi nhận phải trả, phải nộp khác.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('341', 'Vay và nợ thuê tài chính', 'Dư Có', 'Borrowing and fincance lease liabilities', 'Ghi nhận vay và nợ thuê tài chính.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3411', 'Các khoản đi vay', 'Dư Có', 'Borrowing', 'Ghi nhận các khoản đi vay.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3412', 'Nợ thuê tài chính', 'Dư Có', 'Finance lease liabilities', 'Ghi nhận nợ thuê tài chính.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('343', 'Trái phiếu phát hành', 'Dư Có', 'Issued bond', 'Ghi nhận trái phiếu phát hành.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3431', 'Trái phiếu thường', 'Dư Có', 'Common bonds', 'Ghi nhận trái phiếu thường.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('34311', 'Mệnh giá trái phiếu', 'Dư Có', 'Bond face value', 'Ghi nhận mệnh giá trái phiếu.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('34312', 'Chiết khấu trái phiếu', 'Dư Có', 'Bond discount', 'Ghi nhận chiết khấu trái phiếu.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('34313', 'Phụ trội trái phiếu', 'Dư Có', 'Additional bond', 'Ghi nhận phụ trội trái phiếu.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3432', 'Trái phiếu chuyển đổi', 'Dư Nợ', 'Convertible bonds', 'Ghi nhận trái phiếu chuyển đổi.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('344', 'Nhận ký quỹ, ký cược', 'Dư Có', 'Long-term deposits received', 'Ghi nhận nhận ký quỹ, ký cược.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('347', 'Thuế thu nhập hoãn lại phải trả', 'Dư Có', 'Deferred income tax', 'Ghi nhận thuế thu nhập hoãn lại phải trả.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('352', 'Dự phòng phải trả', 'Dư Có', 'Provisions for payables', 'Ghi nhận dự phòng phải trả.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3521', 'Dự phòng bảo hành sản phẩm, hàng hóa', 'Dư Có', 'Product warranty provisions', 'Ghi nhận dự phòng bảo hành sản phẩm, hàng hóa.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3522', 'Dự phòng bảo hành công trình xây dựng', 'Dư Có', 'Construction warranty provision', 'Ghi nhận dự phòng bảo hành công trình xây dựng.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3523', 'Dự phòng tái cơ cấu doanh nghiệp', 'Dư Có', 'Corporate restructuring provision', 'Ghi nhận dự phòng tái cơ cấu doanh nghiệp.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3524', 'Dự phòng phải trả khác', 'Dư Có', 'Other payables provision', 'Ghi nhận dự phòng phải trả khác.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('353', 'Quỹ khen thưởng, phúc lợi', 'Dư Có', 'Bonus & welfare funds', 'Ghi nhận quỹ khen thưởng, phúc lợi.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3531', 'Quỹ khen thưởng', 'Dư Có', 'Bonus fund', 'Ghi nhận quỹ khen thưởng.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3532', 'Quỹ phúc lợi', 'Dư Có', 'Welfare fund', 'Ghi nhận quỹ phúc lợi.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3533', 'Quỹ phúc lợi đã hình thành TSCĐ', 'Dư Có', 'Welfare fund used to acquire fixed assets', 'Ghi nhận quỹ phúc lợi đã hình thành tscđ.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3534', 'Quỹ thưởng ban quản lý điều hành công ty', 'Dư Có', 'Reward fund for management and operating company', 'Ghi nhận quỹ thưởng ban quản lý điều hành công ty.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('356', 'Quỹ phát triển khoa học và công nghệ', 'Dư Có', 'Development of science and technology fund', 'Ghi nhận quỹ phát triển khoa học và công nghệ.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3561', 'Quỹ phát triển khoa học và công nghệ', 'Dư Có', 'Development of science and technology fund', 'Ghi nhận quỹ phát triển khoa học và công nghệ.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('3562', 'Quỹ phát triển khoa học và công nghệ đã hình thành TSCĐ', 'Dư Có', 'Development of science and technology fund used to fixed assets', 'Ghi nhận quỹ phát triển khoa học và công nghệ đã hình thành tscđ.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('357', 'Quỹ bình ổn giá', 'Dư Có', 'Stabilitization fund', 'Ghi nhận quỹ bình ổn giá.', 'Công nợ nhà cung cấp, thuế, lương, vay ngân hàng, doanh thu nhận trước hoặc quỹ.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('411', 'Vốn đầu tư của chủ sở hữu', 'Dư Có', 'Working capital', 'Ghi nhận vốn đầu tư của chủ sở hữu.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('4111', 'Vốn góp của chủ sở hữu', 'Dư Có', 'Contributed legal capital', 'Ghi nhận vốn góp của chủ sở hữu.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('4112', 'Thặng dư vốn cổ phần', 'Dư Có', 'Share premium', 'Ghi nhận thặng dư vốn cổ phần.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('4113', 'Quyền chọn chuyển đổi trái phiếu', 'Dư Có', 'Conversion option bonds', 'Ghi nhận quyền chọn chuyển đổi trái phiếu.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('4118', 'Vốn khác', 'Dư Có', 'Other capital', 'Ghi nhận vốn khác.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('412', 'Chênh lệch đánh giá lại tài sản', 'Lưỡng tính', 'Differences upon asset revaluation', 'Ghi nhận chênh lệch đánh giá lại tài sản.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('413', 'Chênh lệch tỷ giá hối đoái', 'Lưỡng tính', 'Foreign exchange differences', 'Ghi nhận chênh lệch tỷ giá hối đoái.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('4131', 'Chênh lệch tỷ giá do đánh giá lại các khoản mục tiền tệ có gốc ngoại tệ', 'Lưỡng tính', 'Foreign exchange differences revaluation at the end fiscal year', 'Ghi nhận chênh lệch tỷ giá do đánh giá lại các khoản mục tiền tệ có gốc ngoại tệ.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('4132', 'Chênh lệch tỷ giá hối đoái trong giai đoạn trước hoạt động', 'Lưỡng tính', 'Foreign exchange differences in period capital construction investment', 'Ghi nhận chênh lệch tỷ giá hối đoái trong giai đoạn trước hoạt động.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('414', 'Quỹ đầu tư phát triển', 'Dư Có', 'Investment & development funds', 'Ghi nhận quỹ đầu tư phát triển.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('418', 'Các quỹ khác thuộc vốn chủ sở hữu', 'Dư Có', 'Other funds', 'Ghi nhận các quỹ khác thuộc vốn chủ sở hữu.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('419', 'Cổ phiếu mua lại của chính mình', 'Dư Nợ', 'Treasury Stock', 'Ghi nhận cổ phiếu mua lại của chính mình.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('421', 'Lợi nhuận sau thuế chưa phân phối', 'Lưỡng tính', 'Undistributed earnings', 'Ghi nhận lợi nhuận sau thuế chưa phân phối.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('4211', 'Lợi nhuận sau thuế chưa phân phối lũy kế đến cuối năm trước', 'Lưỡng tính', 'Previous year undistributed earnings', 'Ghi nhận lợi nhuận sau thuế chưa phân phối lũy kế đến cuối năm trước.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('4212', 'Lợi nhuận sau thuế chưa phân phối năm nay', 'Lưỡng tính', 'This year undistributed earnings', 'Ghi nhận lợi nhuận sau thuế chưa phân phối năm nay.', 'Vốn góp cổ đông, chênh lệch tỷ giá hoặc lợi nhuận chưa phân phối.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('511', 'Doanh thu bán hàng và cung cấp dịch vụ', 'Lưỡng tính', 'Sales', 'Ghi nhận doanh thu từ doanh thu bán hàng và cung cấp dịch vụ.', 'Bán thiết bị CNTT, bản quyền phần mềm, triển khai hệ thống, Managed Service hoặc SaaS.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5111', 'Doanh thu bán hàng hóa', 'Lưỡng tính', 'Goods sale', 'Ghi nhận doanh thu từ doanh thu bán hàng hóa.', 'Bán thiết bị CNTT, bản quyền phần mềm, triển khai hệ thống, Managed Service hoặc SaaS.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5112', 'Doanh thu bán các thành phẩm', 'Lưỡng tính', 'Finished product sale', 'Ghi nhận doanh thu từ doanh thu bán các thành phẩm.', 'Bán thiết bị CNTT, bản quyền phần mềm, triển khai hệ thống, Managed Service hoặc SaaS.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5113', 'Doanh thu cung cấp dịch vụ', 'Lưỡng tính', 'Turnover from service provision', 'Ghi nhận doanh thu từ doanh thu cung cấp dịch vụ.', 'Bán thiết bị CNTT, bản quyền phần mềm, triển khai hệ thống, Managed Service hoặc SaaS.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5114', 'Doanh thu trợ cấp, trợ giá', 'Lưỡng tính', 'Subsidization sale', 'Ghi nhận doanh thu từ doanh thu trợ cấp, trợ giá.', 'Bán thiết bị CNTT, bản quyền phần mềm, triển khai hệ thống, Managed Service hoặc SaaS.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5117', 'Doanh thu kinh doanh bất động sản đầu tư', 'Lưỡng tính', 'Investment real estate sale', 'Ghi nhận doanh thu từ doanh thu kinh doanh bất động sản đầu tư.', 'Bán thiết bị CNTT, bản quyền phần mềm, triển khai hệ thống, Managed Service hoặc SaaS.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5118', 'Doanh thu khác', 'Lưỡng tính', 'Other sales', 'Ghi nhận doanh thu từ doanh thu khác.', 'Bán thiết bị CNTT, bản quyền phần mềm, triển khai hệ thống, Managed Service hoặc SaaS.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('515', 'Doanh thu hoạt động tài chính', 'Lưỡng tính', 'Turnover from financial operations', 'Ghi nhận thu nhập từ hoạt động tài chính.', 'Lãi tiền gửi, lãi CCTG, cổ tức, lãi bán chứng chỉ quỹ hoặc cổ phiếu.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('521', 'Các khoản giảm trừ doanh thu', 'Lưỡng tính', 'Deduction from income', 'Ghi nhận các khoản giảm trừ doanh thu.', 'Chiết khấu thương mại, hàng bán trả lại hoặc giảm giá do không đạt cam kết.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5211', 'Chiết khấu thương mại', 'Lưỡng tính', 'Sale discount', 'Ghi nhận chiết khấu thương mại.', 'Chiết khấu thương mại, hàng bán trả lại hoặc giảm giá do không đạt cam kết.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5212', 'Hàng bán bị trả lại', 'Lưỡng tính', 'Sale returns', 'Ghi nhận hàng bán bị trả lại.', 'Chiết khấu thương mại, hàng bán trả lại hoặc giảm giá do không đạt cam kết.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('5213', 'Giảm giá hàng bán', 'Lưỡng tính', 'Devaluation of sale price', 'Ghi nhận giảm giá hàng bán.', 'Chiết khấu thương mại, hàng bán trả lại hoặc giảm giá do không đạt cam kết.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Doanh Thu'),
    ('621', 'Chi phí nguyên liệu, vật liệu trực tiếp', 'Lưỡng tính', 'Direct raw materials cost', 'Ghi nhận chi phí nguyên liệu, vật liệu trực tiếp.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('622', 'Chi phí nhân công trực tiếp', 'Lưỡng tính', 'Direct labor cost', 'Ghi nhận chi phí nhân công trực tiếp.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('623', 'Chi phí sử dụng máy thi công', 'Lưỡng tính', 'Executing machine using cost', 'Ghi nhận chi phí sử dụng máy thi công.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí');

INSERT INTO public.finance (
    finance_account_number,
    finance_account_name,
    finance_type,
    english_name,
    description,
    example,
    status,
    department,
    finance_account_standard,
    operation_type
)
VALUES
    ('6231', 'Chi phí nhân công', 'Lưỡng tính', 'Labor cost', 'Ghi nhận chi phí nhân công.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6232', 'Chi phí vật liệu', 'Lưỡng tính', 'Material cost', 'Ghi nhận chi phí vật liệu.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6233', 'Chi phí dụng cụ sản xuất', 'Lưỡng tính', 'Production tool cost', 'Ghi nhận chi phí dụng cụ sản xuất.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6234', 'Chi phí khấu hao máy thi công', 'Lưỡng tính', 'Executing machine depreciation', 'Ghi nhận chi phí khấu hao máy thi công.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6237', 'Chi phí dịch vụ mua ngoài', 'Lưỡng tính', 'Outside purchasing services cost', 'Ghi nhận chi phí dịch vụ mua ngoài.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6238', 'Chi phí bằng tiền khác', 'Lưỡng tính', 'Other cost of cash', 'Ghi nhận chi phí bằng tiền khác.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('627', 'Chi phí sản xuất chung', 'Lưỡng tính', 'General operation cost', 'Ghi nhận chi phí sản xuất chung.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6271', 'Chi phí nhân viên phân xưởng', 'Lưỡng tính', 'Employees cost', 'Ghi nhận chi phí nhân viên phân xưởng.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6272', 'Chi phí vật liệu', 'Lưỡng tính', 'Material cost', 'Ghi nhận chi phí vật liệu.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6273', 'Chi phí dụng cụ sản xuất', 'Lưỡng tính', 'Production tool cost', 'Ghi nhận chi phí dụng cụ sản xuất.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6274', 'Chi phí khấu hao TSCĐ', 'Lưỡng tính', 'Fixed asset depreciation', 'Ghi nhận chi phí khấu hao tscđ.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6275', 'Thuế, phí, lệ phí', 'Lưỡng tính', 'Tax, free, charge', 'Ghi nhận thuế, phí, lệ phí.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6277', 'Chi phí dịch vụ mua ngoài', 'Lưỡng tính', 'Outside purchasing services cost', 'Ghi nhận chi phí dịch vụ mua ngoài.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6278', 'Chi phí bằng tiền khác', 'Lưỡng tính', 'Other cost of cash', 'Ghi nhận chi phí bằng tiền khác.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('632', 'Giá vốn hàng bán', 'Lưỡng tính', 'Cost of goods sold', 'Ghi nhận giá vốn hàng bán.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('635', 'Chi phí tài chính', 'Lưỡng tính', 'Financial activities expenses', 'Ghi nhận chi phí tài chính.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('641', 'Chi phí bán hàng', 'Lưỡng tính', 'Selling expenses', 'Ghi nhận chi phí bán hàng.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6411', 'Chi phí nhân viên', 'Lưỡng tính', 'Employees cost', 'Ghi nhận chi phí nhân viên.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6412', 'Chi phí vật liệu, bao bì', 'Lưỡng tính', 'Material, packing cost', 'Ghi nhận chi phí vật liệu, bao bì.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6413', 'Chi phí dụng cụ, đồ dùng', 'Lưỡng tính', 'Tool cost', 'Ghi nhận chi phí dụng cụ, đồ dùng.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6414', 'Chi phí khấu hao TSCĐ', 'Lưỡng tính', 'Fixed asset depreciation', 'Ghi nhận chi phí khấu hao tscđ.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6415', 'Thuế, phí, lệ phí', 'Lưỡng tính', 'Taxes, Fees and Charges', 'Ghi nhận thuế, phí, lệ phí.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6417', 'Chi phí dịch vụ mua ngoài', 'Lưỡng tính', 'Outside purchasing services cost', 'Ghi nhận chi phí dịch vụ mua ngoài.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6418', 'Chi phí bằng tiền khác', 'Lưỡng tính', 'Other cost of cash', 'Ghi nhận chi phí bằng tiền khác.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('642', 'Chi phí quản lý doanh nghiệp', 'Lưỡng tính', 'General & administration expenses', 'Ghi nhận chi phí quản lý doanh nghiệp.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6421', 'Chi phí nhân viên quản lý', 'Lưỡng tính', 'Employees cost', 'Ghi nhận chi phí nhân viên quản lý.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6422', 'Chi phí vật liệu quản lý', 'Lưỡng tính', 'Tools cost', 'Ghi nhận chi phí vật liệu quản lý.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6423', 'Chi phí đồ dùng văn phòng', 'Lưỡng tính', 'Stationery cost', 'Ghi nhận chi phí đồ dùng văn phòng.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6424', 'Chi phí khấu hao TSCĐ', 'Lưỡng tính', 'Fixed asset depreciation', 'Ghi nhận chi phí khấu hao tscđ.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6425', 'Thuế, phí và lệ phí', 'Lưỡng tính', 'Taxes, fees, charges', 'Ghi nhận thuế, phí và lệ phí.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6426', 'Chi phí dự phòng', 'Lưỡng tính', 'Provision cost', 'Ghi nhận chi phí dự phòng.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6427', 'Chi phí dịch vụ mua ngoài', 'Lưỡng tính', 'Outside purchasing services cost', 'Ghi nhận chi phí dịch vụ mua ngoài.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('6428', 'Chi phí bằng tiền khác', 'Lưỡng tính', 'Other cost of cash', 'Ghi nhận chi phí bằng tiền khác.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE, SALE AND MARKETING, OPERATION', 'Vietnam', 'Chi phí'),
    ('711', 'Thu nhập khác', 'Lưỡng tính', 'Other income', 'Ghi nhận thu nhập ngoài hoạt động kinh doanh chính.', 'Thanh lý tài sản hoặc tiền bồi thường.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('811', 'Chi phí khác', 'Lưỡng tính', 'Other expenses', 'Ghi nhận chi phí khác.', 'Chi phí triển khai, kỹ sư, vật tư, giá vốn thiết bị, bán hàng, quản lý hoặc chi phí phát sinh khác.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('821', 'Chi phí thuế thu nhập doanh nghiệp', 'Lưỡng tính', 'Business Income tax charge', 'Ghi nhận chi phí thuế thu nhập doanh nghiệp.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('8211', 'Chi phí thuế TNDN hiện hành', 'Lưỡng tính', 'Current business income tax charge', 'Ghi nhận chi phí thuế tndn hiện hành.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('82111', 'Chi phí thuế thu nhập doanh nghiệp hiện hành theo quy định của Luật thuế thu nhập doanh nghiệp', 'Lưỡng tính', 'Current business income tax charge', 'Ghi nhận chi phí thuế thu nhập doanh nghiệp hiện hành theo quy định của luật thuế thu nhập doanh nghiệp.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('82112', 'Chi phí thuế thu nhập doanh nghiệp bổ sung theo quy định thuế tối thiểu toàn cầu', 'Lưỡng tính', 'Additional Corporate Income Tax Expense in Accordance with Global Minimum Tax Regulations', 'Ghi nhận chi phí thuế thu nhập doanh nghiệp bổ sung theo quy định thuế tối thiểu toàn cầu.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('8212', 'Chi phí thuế TNDN hoãn lại', 'Lưỡng tính', 'Deffered business income tax charge', 'Ghi nhận chi phí thuế tndn hoãn lại.', 'Phát sinh theo nghiệp vụ kế toán.', 'Đang sử dụng', 'FINANCE', 'Vietnam', 'Kế Toán'),
    ('911', 'Xác định kết quả kinh doanh', 'Lưỡng tính', 'Evaluation of business results', 'Xác định kết quả kinh doanh cuối kỳ.', 'Kết chuyển doanh thu, chi phí để xác định lợi nhuận.', NULL, 'FINANCE', 'Vietnam', 'Kế Toán');

COMMIT;

select * from finance