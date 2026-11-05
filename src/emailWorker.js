
// src/emailWorker.js
export async function handleEmail(message, env, ctx) {
    const sender = message.from;
    const recipient = message.to;
    const subject = message.headers.get("subject") || "Không có tiêu đề";
    
    // Tạo định dạng thời gian chuẩn giờ Việt Nam (GMT+7)
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

    // Đọc nội dung thô của email
    const rawStream = message.raw;
    const emailBody = await new Response(rawStream).text();

    try {
        // Tự động chọn Database phù hợp hoặc mặc định vào 79king
        const db = env.DB_79KING; 

        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, emailBody, vntime).run();

        console.log(`[Email Routing] Đã lưu thành công email từ: ${sender} gửi đến ${recipient}`);
    } catch (err) {
        console.error("[Email Routing Error] Không thể lưu email vào D1:", err);
    }
}