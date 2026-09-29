const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { seedRequestForAction, cleanUp, pool } = require('./seeder');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5221';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

const testCases = [
  {
    actionId: 'ACT-REQUEST-09',
    name: 'Submit Request',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Submit hiển thị cho Requester khi Request ở trạng thái Draft'
  },
  {
    actionId: 'withdraw_request',
    name: 'Withdraw Request',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Withdraw hiển thị cho Requester khi Request đang chờ phê duyệt'
  },
  {
    actionId: 'approve_request',
    name: 'Approve Request',
    email: 'dzung.nguyen@mps-asia.com',
    targetHash: '#my_approval/TEST-REQ-001',
    description: 'Nút Approve hiển thị cho Người phê duyệt cấp hiện tại'
  },
  {
    actionId: 'reject_request',
    name: 'Reject Request',
    email: 'dzung.nguyen@mps-asia.com',
    targetHash: '#my_approval/TEST-REQ-001',
    description: 'Nút Reject hiển thị cho Người phê duyệt cấp hiện tại'
  },
  {
    actionId: 'ACT-REQUEST-08',
    name: 'Request Start',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Request Start hiển thị cho SR Owner khi đã Approved nhưng chưa bắt đầu xử lý'
  },
  {
    actionId: 'ACT-REQUEST-07',
    name: 'Request Complete',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Request Complete hiển thị cho SR Owner khi đang xử lý (Processing)'
  },
  {
    actionId: 'ACT-REQUEST-06',
    name: 'Request Closed',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Request Closed hiển thị cho Requester khi đã xử lý xong (Completed)'
  },
  {
    actionId: 'ACT-REQUEST-03',
    name: 'Rating Request',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Rate hiển thị cho Requester khi Request đã hoàn thành nhưng chưa được đánh giá'
  },
  {
    actionId: 'ACT-REQUEST-03-RE',
    name: 'Rate Request Again',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001',
    description: 'Nút Rate Again hiển thị cho Requester khi Request đã đóng và đã được đánh giá trước đó'
  },
  {
    actionId: 'ACT-REQUEST-05',
    name: 'Request Cancel',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Request Cancel hiển thị cho SR Owner để hủy bỏ Request đang xử lý'
  },
  {
    actionId: 'ACT-REQUEST-04',
    name: 'Re-update Process Status',
    email: 'dzung.nguyen@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Re-update Process Status hiển thị cho Policy Lead để cập nhật trạng thái khi đã hoàn thành'
  },
  {
    actionId: 'change_sr_owner',
    name: 'Change SR Owner',
    email: 'dzung.nguyen@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Change SR Owner hiển thị cho Policy Lead để chuyển giao người xử lý chính'
  },
  {
    actionId: 'ACT-REQUEST-02',
    name: 'Elements Config',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#my_task/TEST-REQ-001',
    description: 'Nút Elements hiển thị cho SR Owner khi Request ở trạng thái Approved và đang xử lý'
  },
  {
    actionId: 'ACT-REQUEST-016',
    name: 'View Main Request (Liên kết Yêu cầu con -> Yêu cầu cha)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#my_request/TEST-REQ-001-PAY',
    description: 'Nút hiển thị trên chi tiết Yêu cầu con (Sub-Request) giúp người dùng quay lại Yêu cầu cha (Parent Request) đã liên kết'
  },
  {
    actionId: 'payment_req_outgoing',
    name: 'Submit Payment Outgoing (Yêu cầu chi tiền)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Người dùng gửi yêu cầu chi tiền từ bản ghi Payment của Yêu cầu cha. Thao tác này tự động tạo một Yêu cầu con loại \'02a2cf1e\' với trạng thái Pending Approval'
  },
  {
    actionId: 'payment_req_incoming_collection',
    name: 'Request Incoming Collection (Yêu cầu thu tiền)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Người dùng gửi yêu cầu thu tiền đối với Payment thu tiền (Incoming). Thao tác này tự động tạo một Yêu cầu con loại \'02a2cf1e\' với trạng thái Pending Approval'
  },
  {
    actionId: 'payment_req_incoming_status',
    name: 'Request Payment Status Incoming (Cập nhật trạng thái thu)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Người dùng gửi yêu cầu xác nhận trạng thái đối với Payment thu tiền (Incoming). Thao tác này tự động tạo một Yêu cầu con loại \'37eace9f\' với trạng thái Pending Approval'
  },
  {
    actionId: 'payment_ready',
    name: 'Ready for Payment (Khi Yêu cầu con được duyệt)',
    email: 'giang.nguyen@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Sau khi Yêu cầu con (loại \'02a2cf1e\') được phê duyệt thành công, trạng thái Payment liên kết tự động cập nhật thành \'Ready for payment\''
  },
  {
    actionId: 'payment_paid',
    name: 'Confirm Paid (Xác nhận đã thanh toán)',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'SR Owner thực hiện thanh toán cho Payment ở trạng thái \'Ready for payment\', cập nhật trạng thái Payment thành \'Paid\' và điền Mã giao dịch'
  },
  {
    actionId: 'payment_update_transaction',
    name: 'Update Transaction ID (Cập nhật mã giao dịch)',
    email: 'admin_hn@mps-asia.com',
    targetHash: '#payment/TEST-PAY-001',
    description: 'Đối với Payment đã thanh toán (\'Paid\'), SR Owner có quyền cập nhật hoặc điều chỉnh Mã giao dịch (Transaction ID)'
  }
];

async function getAuthToken(email) {
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_id: email })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login failed: ${errorText}`);
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`[ERROR] Failed to get auth token for ${email}:`, err.message);
    throw err;
  }
}

async function runTests() {
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('==================================================');
  console.log('🚀 BẮT ĐẦU CHẠY THỬ NGHIỆM TỰ ĐỘNG HÓA CÁC ACTIONS');
  console.log('==================================================\n');

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`[TEST ${i + 1}/${testCases.length}] Action: ${tc.actionId} (${tc.name})`);
    console.log(` - Mô tả: ${tc.description}`);
    console.log(` - Login với: ${tc.email}`);

    try {
      // 1. Seed the database state for the action
      await seedRequestForAction(tc.actionId);

      // 2. Fetch auth token
      const authData = await getAuthToken(tc.email);

      // 3. Launch Puppeteer Browser
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });

      // 4. Load page origin to initialize localStorage access
      await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });

      // 5. Inject token and user details into localStorage
      await page.evaluate((token, user) => {
        localStorage.setItem('crc_token', token);
        localStorage.setItem('crc_user', JSON.stringify(user));
      }, authData.token, authData.user);

      // 6. Navigate directly to target detail page
      const targetUrl = `${BASE_URL}/${tc.targetHash}`;
      console.log(` - Di chuyển đến URL: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'networkidle2' });

      // 7. Wait for detail page layout to render stably
      await page.waitForSelector('.detail-layout', { timeout: 10000 });
      // Extra delay for dynamic fetches (lookups, actions API)
      await new Promise(r => setTimeout(r, 2000));

      // 8. Highlight the action buttons container to stand out in the report
      await page.evaluate(() => {
        const container = document.getElementById('detail-actions-container');
        if (container) {
          container.style.border = '2px dashed #ff4500';
          container.style.padding = '6px';
          container.style.borderRadius = '8px';
          container.style.backgroundColor = 'rgba(255, 69, 0, 0.05)';
        }
      });

      // 9. Capture screenshot
      const imgPath = path.join(SCREENSHOT_DIR, `${tc.actionId}.png`);
      await page.screenshot({ path: imgPath, fullPage: false });
      console.log(` ✅ Chụp ảnh thành công: ${imgPath}\n`);

      // 10. Clean up browser
      await browser.close();

    } catch (err) {
      console.error(` ❌ Lỗi khi thực hiện kiểm thử cho action ${tc.actionId}:`, err.message);
    }
  }

  // Final cleanup of test data
  console.log('🧹 Đang làm sạch dữ liệu kiểm thử trong Database...');
  await cleanUp();
  await pool.end();

  console.log('\n==================================================');
  console.log('🎉 ĐÃ HOÀN THÀNH TẤT CẢ KIỂM THỬ VÀ CHỤP MÀN HÌNH');
  console.log('==================================================');
}

runTests().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
