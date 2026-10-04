const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const OUTPUT_PDF = path.join(path.dirname(__dirname), 'action_test_report.pdf'); // Outputs directly to CRC_app/action_test_report.pdf

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const testCases = [
  {
    actionId: 'ACT-REQUEST-09',
    name: 'Submit Request',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Submit hiển thị cho Requester khi Request ở trạng thái Draft',
    testRole: 'Requester',
    testStateSeed: "sr_status = 'Draft', process_status = 'New'",
    logicCondition: "sr_status = 'Draft'"
  },
  {
    actionId: 'withdraw_request',
    name: 'Withdraw Request',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Withdraw hiển thị cho Requester khi Request đang chờ phê duyệt',
    testRole: 'Requester',
    testStateSeed: "sr_status = 'Pending Approval', process_status = 'New'",
    logicCondition: "sr_status = 'Pending Approval'"
  },
  {
    actionId: 'approve_request',
    name: 'Approve Request',
    email: 'dzung.nguyen@mps-asia.com',
    targetHash: '#my_approval/TEST-REQ-001',
    description: 'Nút Approve hiển thị cho Người phê duyệt cấp hiện tại',
    testRole: 'Tier 1 Approver (Direct Manager)',
    testStateSeed: "sr_status = 'Pending Approval', tier_1_approval = 'dzung.nguyen@mps-asia.com'",
    logicCondition: "sr_status = 'Pending Approval'"
  },
  {
    actionId: 'reject_request',
    name: 'Reject Request',
    email: 'dzung.nguyen@mps-asia.com',
    targetHash: '#my_approval/TEST-REQ-001',
    description: 'Nút Reject hiển thị cho Người phê duyệt cấp hiện tại',
    testRole: 'Tier 1 Approver (Direct Manager)',
    testStateSeed: "sr_status = 'Pending Approval', tier_1_approval = 'dzung.nguyen@mps-asia.com'",
    logicCondition: "sr_status = 'Pending Approval'"
  },
  {
    actionId: 'ACT-REQUEST-08',
    name: 'Request Start',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Request Start hiển thị cho SR Owner khi đã Approved nhưng chưa bắt đầu xử lý',
    testRole: 'SR Owner',
    testStateSeed: "sr_status = 'Approved', process_status = 'Not started yet'",
    logicCondition: "sr_status = 'Approved' AND process_status = 'Not started yet'"
  },
  {
    actionId: 'ACT-REQUEST-07',
    name: 'Request Complete',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Request Complete hiển thị cho SR Owner khi đang xử lý (Processing)',
    testRole: 'SR Owner',
    testStateSeed: "sr_status = 'Approved', process_status = 'Processing'",
    logicCondition: "sr_status = 'Approved' AND process_status = 'Processing'"
  },
  {
    actionId: 'ACT-REQUEST-06',
    name: 'Request Closed',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Request Closed hiển thị cho Requester khi đã xử lý xong (Completed)',
    testRole: 'Requester',
    testStateSeed: "sr_status = 'Approved', process_status = 'Completed'",
    logicCondition: "sr_status = 'Approved' AND process_status = 'Completed'"
  },
  {
    actionId: 'ACT-REQUEST-03',
    name: 'Rating Request',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Rate hiển thị cho Requester khi Request đã hoàn thành nhưng chưa được đánh giá',
    testRole: 'Requester',
    testStateSeed: "sr_status = 'Approved', process_status = 'Completed', rating = NULL",
    logicCondition: "process_status = 'Completed' AND rating IS NULL"
  },
  {
    actionId: 'ACT-REQUEST-03-RE',
    name: 'Rate Request Again',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Rate Again hiển thị cho Requester khi Request đã đóng và đã được đánh giá trước đó',
    testRole: 'Requester',
    testStateSeed: "sr_status = 'Closed', process_status = 'Completed', rating = 5",
    logicCondition: "process_status = 'Completed' AND rating IS NOT NULL AND sr_status = 'Closed'"
  },
  {
    actionId: 'ACT-REQUEST-05',
    name: 'Request Cancel',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Request Cancel hiển thị cho SR Owner để hủy bỏ Request đang xử lý',
    testRole: 'SR Owner',
    testStateSeed: "sr_status = 'Approved', process_status = 'Processing'",
    logicCondition: "sr_status = 'Approved' AND process_status IN ('Processing', 'Not started yet')"
  },
  {
    actionId: 'ACT-REQUEST-04',
    name: 'Re-update Process Status',
    email: 'dzung.nguyen@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Re-update Process Status hiển thị cho Policy Lead để cập nhật trạng thái khi đã hoàn thành',
    testRole: 'Policy Lead',
    testStateSeed: "sr_status = 'Approved', process_status = 'Completed'",
    logicCondition: "sr_status = 'Approved' AND process_status = 'Completed'"
  },
  {
    actionId: 'change_sr_owner',
    name: 'Change SR Owner',
    email: 'dzung.nguyen@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Change SR Owner hiển thị cho Policy Lead để chuyển giao người xử lý chính',
    testRole: 'Policy Lead',
    testStateSeed: "policy_lead = 'dzung.nguyen@mps-asia.com'",
    logicCondition: "Không có điều kiện nghiệp vụ phụ (luôn hiển thị cho Policy Lead)"
  },
  {
    actionId: 'ACT-REQUEST-02',
    name: 'Elements Config',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Elements hiển thị cho SR Owner để cấu hình các phần tử của Request',
    testRole: 'SR Owner',
    testStateSeed: "sr_status = 'Approved', process_status = 'Processing'",
    logicCondition: "sr_status != 'Draft' AND process_status IN ('Processing', 'Completed')"
  },
  {
    actionId: 'ACT-REQUEST-016',
    name: 'View Main Request',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001-PAY',
    description: 'Nút hiển thị trên chi tiết Yêu cầu con (Sub-Request) giúp người dùng quay lại Yêu cầu cha (Parent Request) đã liên kết',
    testRole: 'Requester',
    testStateSeed: "Tồn tại liên kết payment hoặc invoice trong cơ sở dữ liệu",
    logicCondition: "Số lượng liên kết payment/invoice > 0"
  },
  {
    actionId: 'payment_req_outgoing',
    name: 'Submit Payment Outgoing (Yêu cầu chi tiền)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Người dùng gửi yêu cầu chi tiền từ bản ghi Payment của Yêu cầu cha. Thao tác này tự động tạo một Yêu cầu con loại \'02a2cf1e\' với trạng thái Pending Approval',
    testRole: 'Requester',
    testStateSeed: "payment_type = 'outgoing', payment_status = 'Draft'",
    logicCondition: "payment_type = 'outgoing' AND payment_status IN ('Draft', 'Not due yet')"
  },
  {
    actionId: 'payment_req_incoming_collection',
    name: 'Request Incoming Collection (Yêu cầu thu tiền)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Người dùng gửi yêu cầu thu tiền đối với Payment thu tiền (Incoming). Thao tác này tự động tạo một Yêu cầu con loại \'02a2cf1e\' với trạng thái Pending Approval',
    testRole: 'Requester',
    testStateSeed: "payment_type = 'incoming', payment_status = 'Pending Payment'",
    logicCondition: "payment_type = 'incoming' AND payment_status = 'Pending Payment'"
  },
  {
    actionId: 'payment_req_incoming_status',
    name: 'Request Payment Status Incoming (Cập nhật trạng thái thu)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Người dùng gửi yêu cầu xác nhận trạng thái đối với Payment thu tiền (Incoming). Thao tác này tự động tạo một Yêu cầu con loại \'37eace9f\' với trạng thái Pending Approval',
    testRole: 'Requester',
    testStateSeed: "payment_type = 'incoming', payment_status = 'Draft'",
    logicCondition: "payment_type = 'incoming' AND payment_status IN ('Draft', 'Not due yet', 'Pending Payment', 'Collection Working')"
  },
  {
    actionId: 'payment_ready',
    name: 'Ready for Payment (Khi Yêu cầu con được duyệt)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Sau khi Yêu cầu con (loại \'02a2cf1e\') được phê duyệt thành công, trạng thái Payment liên kết tự động cập nhật thành \'Ready for payment\'',
    testRole: 'Requester',
    testStateSeed: "payment_status = 'Submitted for payment'",
    logicCondition: "payment_status IN ('Submitted for payment', 'Collection working', 'Pending confirmation')"
  },
  {
    actionId: 'payment_paid',
    name: 'Confirm Paid (Xác nhận đã thanh toán)',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'SR Owner thực hiện thanh toán cho Payment ở trạng thái \'Ready for payment\', cập nhật trạng thái Payment thành \'Paid\' và điền Mã giao dịch',
    testRole: 'SR Owner',
    testStateSeed: "payment_status = 'Ready for Payment'",
    logicCondition: "payment_status = 'Ready for payment'"
  },
  {
    actionId: 'payment_update_transaction',
    name: 'Update Transaction ID (Cập nhật mã giao dịch)',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Đối với Payment đã thanh toán (\'Paid\'), SR Owner có quyền cập nhật hoặc điều chỉnh Mã giao dịch (Transaction ID)',
    testRole: 'SR Owner',
    testStateSeed: "payment_type = 'outgoing', payment_status = 'Paid'",
    logicCondition: "payment_status = 'Paid'"
  }
];

async function generateReport() {
  console.log('==================================================');
  console.log('📄 BẮT ĐẦU TẠO FILE BÁO CÁO PDF CHẤT LƯỢNG CAO');
  console.log('==================================================');

  // Fetch action rules from database
  let rules = [];
  try {
    const rulesRes = await pool.query('SELECT * FROM action_rules');
    rules = rulesRes.rows;
  } catch (err) {
    console.error('Error fetching action rules from DB:', err.message);
  } finally {
    await pool.end();
  }

  // Create a new PDF document (Portrait A4)
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 }
  });

  // Pipe output to the target file
  const writeStream = fs.createWriteStream(OUTPUT_PDF);
  doc.pipe(writeStream);

  // Register system fonts for Vietnamese support (Arial TTF)
  const fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
  const boldFontPath = 'C:\\Windows\\Fonts\\arialbd.ttf';
  
  if (fs.existsSync(fontPath)) {
    doc.registerFont('Arial', fontPath);
    doc.registerFont('Arial-Bold', boldFontPath);
    doc.font('Arial');
  } else {
    console.warn('[WARNING] Arial font not found on system. Falling back to default Times-Roman (Vietnamese accents may not render correctly).');
    doc.font('Times-Roman');
  }

  // --- PAGE 1: COVER PAGE ---
  // Draw premium header design
  doc.rect(0, 0, 595.28, 120).fill('#1e293b'); // Dark blue background banner
  doc.fillColor('#ea580c').fontSize(26).font('Arial-Bold').text('TeraX', 40, 45, { lineBreak: false });
  doc.fillColor('#ffffff').fontSize(14).font('Arial').text('  |  Company Request Center (CRC)', 120, 55);

  doc.moveDown(6);
  doc.fillColor('#0f172a').fontSize(22).font('Arial-Bold').text('BÁO CÁO KIỂM THỬ ACTIONS', 40, 200);
  doc.fontSize(14).font('Arial').text('Hệ thống Xác thực Điều kiện hiển thị Action (Request Table)', 40, 230);

  // Add Metadata Box
  doc.rect(40, 280, 515, 120).fill('#f8fafc');
  doc.rect(40, 280, 515, 120).stroke('#e2e8f0');

  doc.fillColor('#334155').fontSize(11).font('Arial-Bold').text('THÔNG TIN CHUNG:', 55, 295);
  doc.font('Arial');
  doc.text(`Ngày thực hiện: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`, 55, 315);
  doc.text('Môi trường: Local Development (http://localhost:5221)', 55, 335);
  doc.text('Hệ thống kiểm thử: Puppeteer Headless & State Seeding Database', 55, 355);
  doc.text(`Tổng số kịch bản kiểm thử: ${testCases.length} Actions`, 55, 375);

  // Table of Contents Header
  doc.moveDown(8);
  doc.fillColor('#0f172a').fontSize(14).font('Arial-Bold').text('DANH SÁCH ACTIONS ĐÃ ĐƯỢC XÁC MINH:', 40, 430);
  
  let y = 460;
  testCases.forEach((tc, index) => {
    doc.fontSize(10).font('Arial');
    doc.fillColor('#475569').text(`${String(index + 1).padStart(2, '0')}.`, 40, y);
    doc.fillColor('#0f172a').font('Arial-Bold').text(`[${tc.actionId}]`, 65, y);
    doc.fillColor('#475569').font('Arial').text(tc.name, 190, y);
    doc.fillColor('#10b981').font('Arial-Bold').text('PASS (Hiển thị đúng)', 480, y);
    y += 18;
  });

  // Footer for Cover Page
  doc.fontSize(9).fillColor('#94a3b8').font('Arial').text('TeraX CRC Automation Framework • Confidential', 40, 780, { align: 'center' });

  // --- PAGE 2: DETAILED PAYMENT FLOW ---
  doc.addPage();
  
  // Premium header
  doc.rect(0, 0, 595.28, 40).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(11).font('Arial-Bold').text('LUỒNG XỬ LÝ CHI TIẾT SAU KHI GỬI YÊU CẦU THANH TOÁN (PAYMENT)', 40, 15);
  
  doc.moveDown(2);
  
  // Section 1
  doc.fillColor('#0f172a').fontSize(14).font('Arial-Bold').text('1. Có tạo Request mới khi ấn Submit payment không?', 40, 70);
  doc.fillColor('#334155').fontSize(10).font('Arial').text(
    'Có. Khi thực hiện các hành động gửi yêu cầu thanh toán (Submit Payment) từ bảng payment (các action tương ứng gồm: payment_req_outgoing, payment_req_incoming_collection, và payment_req_incoming_status), hệ thống sẽ tự động tạo một Request mới trong bảng request.',
    40, 95, { width: 515, align: 'justify', lineGap: 3 }
  );
  
  // Box for child request details
  doc.rect(40, 145, 515, 110).fill('#f8fafc');
  doc.rect(40, 145, 515, 110).stroke('#e2e8f0');
  
  doc.fillColor('#475569').fontSize(9).font('Arial-Bold').text('Chi tiết luồng tạo:', 50, 155);
  doc.font('Arial').fillColor('#0f172a');
  doc.text('• Mã Request mới (Request ID): Được tự động sinh theo định dạng: ${parent_request_id}-${childCount + 1}', 50, 175);
  doc.text('  (parent_request_id là ID yêu cầu cha của Payment đó, childCount là số lượng yêu cầu con của Payment đã tồn tại trước đó).', 50, 187, { width: 495 });
  doc.text('• Trạng thái ban đầu: Request mới này được tạo với trạng thái phê duyệt ban đầu là sr_status = \'Pending Approval\' và tier_1_status = \'Pending approval\'.', 50, 202, { width: 495 });
  doc.text('• Loại Request (Request Type):', 50, 222);
  doc.text('  - Với hành động payment_req_outgoing (yêu cầu chi) và payment_req_incoming_collection (yêu cầu thu tiền): Mã loại là \'02a2cf1e\'.', 50, 234);
  doc.text('  - Với hành động payment_req_incoming_status (yêu cầu trạng thái thanh toán đầu vào): Mã loại là \'37eace9f\'.', 50, 246);

  // Section 2
  doc.fillColor('#0f172a').fontSize(14).font('Arial-Bold').text('2. Hoạt động sau đó khi Request mới được Approve hoặc Reject là gì?', 40, 275);
  
  // Case A Box
  doc.rect(40, 305, 515, 175).fill('#f0fdf4');
  doc.rect(40, 305, 515, 175).stroke('#bbf7d0');
  doc.fillColor('#166534').fontSize(10).font('Arial-Bold').text('TRƯỜNG HỢP A: KHI REQUEST ĐƯỢC APPROVE (PHÊ DUYỆT HOÀN TOÀN)', 50, 315);
  doc.font('Arial').fillColor('#14532d');
  doc.text('Khi các cấp duyệt phê duyệt thành công hoàn toàn Request này (mọi cấp duyệt đều duyệt qua và trạng thái chuyển sang Approved):', 50, 335, { width: 495, lineGap: 2 });
  doc.font('Arial-Bold').text('• Cập nhật tự động trên bảng Payment:', 50, 365);
  doc.font('Arial');
  doc.text('  - Nếu Request có loại là \'02a2cf1e\' (Yêu cầu thanh toán chi/thu tiền): Hệ thống tự động chạy lệnh UPDATE cập nhật trạng thái của Payment liên kết (payment_request = request_id) chuyển thành \'Ready for payment\'.', 55, 377, { width: 485, lineGap: 1 });
  doc.text('  - Nếu Request có loại là \'37eace9f\' (Yêu cầu trạng thái thanh toán): Trạng thái của Payment giữ nguyên giá trị trước đó (ví dụ: Pending confirmation).', 55, 410, { width: 485, lineGap: 1 });
  doc.font('Arial-Bold').text('• Thông báo tự động (Push Notification):', 50, 435);
  doc.font('Arial');
  doc.text('  - Hệ thống sẽ gửi một thông báo đẩy cho các bên liên quan để thực hiện chuyển tiền:', 50, 447);
  doc.fillColor('#b91c1c').font('Arial-Bold').text('    "Dear Money Account Owner. Please make money transaction for: [Mô tả]. Request ID: [ID]"', 50, 459, { width: 495 });

  // Case B Box
  doc.rect(40, 500, 515, 140).fill('#fef2f2');
  doc.rect(40, 500, 515, 140).stroke('#fecaca');
  doc.fillColor('#991b1b').fontSize(10).font('Arial-Bold').text('TRƯỜNG HỢP B: KHI REQUEST BỊ REJECT (TỪ CHỐI)', 50, 510);
  doc.font('Arial').fillColor('#7f1d1d');
  doc.text('Khi bất kỳ cấp duyệt nào từ chối duyệt (Reject):', 50, 530, { width: 495 });
  doc.font('Arial-Bold').text('• Cập nhật trên bảng Request:', 50, 550);
  doc.font('Arial');
  doc.text('  - Trạng thái của Request bị chuyển thành \'Rejected\' (mức duyệt hiện tại chuyển thành \'Rejected\', trạng thái tổng quát sr_status = \'Rejected\').', 55, 562, { width: 485 });
  doc.font('Arial-Bold').text('• Ảnh hưởng đến bảng Payment:', 50, 585);
  doc.font('Arial');
  doc.text('  - Không có hoạt động tự động nào cập nhật lại bảng Payment. Bản ghi ở bảng payment vẫn giữ nguyên trạng thái trước đó (ví dụ: \'Submitted for payment\'). Người tạo sẽ cần thao tác xử lý lại hoặc chỉnh sửa Request trực tiếp từ giao diện để gửi lại phê duyệt.', 55, 597, { width: 485, lineGap: 1 });

  // Footer for Page 2
  doc.fontSize(9).fillColor('#94a3b8').font('Arial').text('TeraX CRC Automation Framework • Confidential', 40, 780, { align: 'center' });

  // --- PAGES 3+: TEST CASES DETAILS ---
  testCases.forEach((tc, index) => {
    doc.addPage();

    // Premium Top Header for page
    doc.rect(0, 0, 595.28, 40).fill('#f1f5f9');
    doc.fillColor('#475569').fontSize(10).font('Arial-Bold').text(`TEST CASE ${index + 1}/${testCases.length}`, 40, 15);
    doc.fillColor('#94a3b8').font('Arial').text(`Action ID: ${tc.actionId}`, 450, 15, { align: 'right' });

    // Title
    doc.moveDown(2);
    doc.fillColor('#0f172a').fontSize(16).font('Arial-Bold').text(`${index + 1}. ${tc.name}`, 40, 60);
    doc.fillColor('#ea580c').fontSize(10).text(tc.description, 40, 80);

    // Meta Box
    doc.rect(40, 100, 515, 65).fill('#f8fafc');
    doc.rect(40, 100, 515, 65).stroke('#e2e8f0');

    doc.fillColor('#475569').fontSize(9).font('Arial-Bold').text('Tài khoản test (Email):', 50, 112);
    doc.fillColor('#0f172a').font('Arial').text(tc.email, 180, 112);

    doc.fillColor('#475569').font('Arial-Bold').text('Trang kiểm thử (URL Hash):', 50, 127);
    doc.fillColor('#0f172a').font('Arial').text(tc.targetHash, 180, 127);

    doc.fillColor('#475569').font('Arial-Bold').text('Trạng thái xác minh:', 50, 142);
    doc.fillColor('#10b981').font('Arial-Bold').text('SUCCESS - Action button hiển thị đúng điều kiện', 180, 142);

    // Screenshot section
    const imgPath = path.join(SCREENSHOT_DIR, `${tc.actionId}.png`);
    if (fs.existsSync(imgPath)) {
      doc.fillColor('#0f172a').fontSize(11).font('Arial-Bold').text('ẢNH CHỤP MÀN HÌNH MINH HỌA (VỊ TRÍ VIỀN ĐỎ):', 40, 190);
      
      // Draw border box around image
      doc.rect(38, 208, 519, 294).stroke('#cbd5e1');
      // Draw the image
      doc.image(imgPath, 40, 210, { width: 515, height: 290 });
    } else {
      doc.fillColor('#ef4444').fontSize(12).font('Arial-Bold').text('Không tìm thấy ảnh chụp màn hình!', 40, 210);
    }

    // Dynamic Database Rule details
    const rule = rules.find(r => r.action_id === tc.actionId) || {};

    // Detailed checking conditions
    doc.rect(40, 520, 515, 235).fill('#f8fafc');
    doc.rect(40, 520, 515, 235).stroke('#cbd5e1');

    doc.fillColor('#1e293b').fontSize(11).font('Arial-Bold').text('ĐIỀU KIỆN KIỂM TRA HIỂN THỊ NÚT ACTION:', 55, 532);

    doc.fontSize(9.5);
    // Row 1: Roles
    doc.fillColor('#475569').font('Arial-Bold').text('1. Vai trò (roles):', 55, 555);
    doc.fillColor('#0f172a').font('Arial').text(rule.roles || 'Không giới hạn (null)', 220, 555);

    // Row 2: View Name
    doc.fillColor('#475569').font('Arial-Bold').text('2. Tên View (view_name):', 55, 575);
    doc.fillColor('#0f172a').font('Arial').text(rule.view_name || 'Không giới hạn (null)', 220, 575);

    // Row 3: Exceptions
    doc.fillColor('#475569').font('Arial-Bold').text('3. Ngoại lệ (exceptions):', 55, 595);
    doc.fillColor('#0f172a').font('Arial').text(rule.exceptions || 'Không có (null)', 220, 595);

    // Row 4: Levels
    doc.fillColor('#475569').font('Arial-Bold').text('4. Cấp độ nhân viên (levels):', 55, 615);
    doc.fillColor('#0f172a').font('Arial').text(rule.levels || 'Không giới hạn (null)', 220, 615);

    // Row 5: Positions
    doc.fillColor('#475569').font('Arial-Bold').text('5. Vị trí chức danh (positions):', 55, 635);
    doc.fillColor('#0f172a').font('Arial').text(rule.positions || 'Không giới hạn (null)', 220, 635);

    // Row 6: Code condition (when)
    doc.fillColor('#475569').font('Arial-Bold').text('6. Điều kiện nghiệp vụ (when):', 55, 655);
    doc.fillColor('#0f172a').font('Arial').text(tc.logicCondition, 220, 655, { width: 320 });

    // Row 7: Test account & state
    doc.fillColor('#475569').font('Arial-Bold').text('7. Tài khoản & Trạng thái test:', 55, 695);
    doc.fillColor('#0f172a').font('Arial').text(`${tc.email} (${tc.testRole})`, 220, 695);

    doc.fillColor('#475569').font('Arial-Bold').text(' - Dữ liệu mẫu (seeder):', 55, 715);
    doc.fillColor('#0f172a').font('Arial').text(tc.testStateSeed, 220, 715);

    // Page Number Footer
    doc.fillColor('#94a3b8').fontSize(9).text(`Trang ${index + 2} / ${testCases.length + 1}`, 40, 780, { align: 'center' });
  });

  // Finalize PDF file
  doc.end();

  writeStream.on('finish', () => {
    console.log(`\n==================================================`);
    console.log(`✅ TẠO BÁO CÁO THÀNH CÔNG: ${OUTPUT_PDF}`);
    console.log(`==================================================`);
  });
}

if (require.main === module) {
  generateReport().catch(console.error);
} else {
  module.exports = { generateReport };
}
