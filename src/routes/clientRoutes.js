// routes/clientRoutes.js
import { Hono } from 'hono';
const client = new Hono();

client.post('/claim', async (c) => {
    try {
        // 1. LẤY DỮ LIỆU TỪ FRONTEND
        const body = await c.req.json();
        const { username, code, captchaToken, canvasFp } = body;
        
        const db = c.get('selectedDB');
        const SECRET_KEY = c.env.TURNSTILE_SECRET;
        const cleanCode = code.trim().toUpperCase();
        const clientIP = c.req.header('CF-Connecting-IP') || 'Unknown';
        const userAgent = c.req.header('User-Agent') || 'Unknown';

        const todayDate = new Intl.DateTimeFormat('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date()); 

        // 2. TẠO LUÔN CHUỖI THỜI GIAN ĐẦY ĐỦ ĐỂ LƯU VÀO DB
        const vntime = new Intl.DateTimeFormat('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        hour12: false
        }).format(new Date());


        // 2. XÁC THỰC CAPTCHA TURNSTILE
        const formData = new FormData();
        formData.append('secret', SECRET_KEY);
        formData.append('response', captchaToken);

        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            body: formData,
            method: 'POST',
        });

        const outcome = await verifyRes.json();
        if (!outcome.success) {
            return c.json({ success: false, message: "Xác thực Captcha thất bại!" }, 403);
        }

        const cleanUsername = username.trim().toUpperCase();
        const alreadyClaimedToday = await db.prepare(
            "SELECT id FROM history WHERE UPPER(username) = ? AND used_at LIKE ? LIMIT 1"
        ).bind(cleanUsername, `%${todayDate}%`).first();

        if (alreadyClaimedToday) {
            return c.json({ 
                success: false, 
                message: "Tài khoản của quý khách đã nhập thành công mã trong ngày hôm nay nên không thể tiếp tục nhập. Xin quý khách vui lòng quay lại vào ngày mai để nhận thưởng tiếp theo nhé!" 
            });
        }

        // 3. KIỂM TRA MÃ TRƯỚC (READ-ONLY)
        // Chỉ lấy ID và kiểm tra xem còn lượt không trước khi thực hiện ghi dữ liệu
        const codeData = await db.prepare(
            "SELECT id, amount FROM codes WHERE UPPER(code_value) = ? LIMIT 1"
        ).bind(cleanCode).first();

        if (!codeData || codeData.amount <= 0) {
            return c.json({ success: false, message: "Mã không hợp lệ hoặc đã hết lượt nhận!" });
        }

        // 4. THỰC THI BATCH (UPDATE & INSERT ĐỒNG THỜI)
        const now = new Date();

        try {
            // Sử dụng db.batch để gộp các lệnh ghi vào 1 giao dịch duy nhất
            const batchResult = await db.batch([
                // CỰC KỲ QUAN TRỌNG: Chỉ update nếu amount > 0 để tránh mã ảo khi 300 người nhấn cùng lúc
                db.prepare("UPDATE codes SET amount = amount - 1 WHERE id = ? AND amount > 0").bind(codeData.id),
                // Ghi lịch sử nhận thưởng
                db.prepare("INSERT INTO history (username, code_value, used_at, ip, ua, canvas_fp) VALUES (?, ?, ?, ?, ?, ?)")
                  .bind(username, cleanCode, vntime, clientIP, userAgent, canvasFp)
            ]);

            // Kiểm tra xem lệnh UPDATE có tác động đến dòng nào không
            // Nếu rows_affected === 0 nghĩa là mã đã bị người khác nhận hết ngay trước đó 1 mili giây
            if (batchResult[0].meta.rows_affected === 0) {
                return c.json({ success: false, message: "Rất tiếc! Mã vừa mới hết lượt cách đây vài giây." });
            }

            // 5. TRẢ KẾT QUẢ THÀNH CÔNG
            return c.json({ 
                success: true, 
                data: { username, code: cleanCode, time: vntime } 
            });

        } catch (batchError) {
            console.error("Lỗi thực thi Batch:", batchError);
            return c.json({ success: false, message: "Hệ thống đang quá tải, sếp hãy thử lại sau!" }, 500);
        }

    } catch (error) {
        console.error("Lỗi xử lý Claim:", error);
        return c.json({ success: false, message: "Lỗi kết nối máy chủ!" }, 500);
    }
});

export default client;