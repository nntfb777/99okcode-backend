// src/emailWorker.js
export async function handleEmail(message, env, ctx) {
    const sender = message.from;
    const recipient = message.to;
    const rawSubject = message.headers.get("subject") || "Không có tiêu đề";
    const subject = decodeMimeHeader(rawSubject); // Vẫn giải mã tiêu đề cho đẹp
    
    const vntime = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).format(new Date());

    // Lấy toàn bộ nội dung thô nguyên bản của email
    const rawBodyText = await new Response(message.raw).text();

    try {
        const db = env.DB_79KING || env.DB_99OK; 
        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, rawBodyText, vntime).run();

        console.log(`[Email Routing] Đã lưu raw email thành công: ${subject}`);
    } catch (err) {
        console.error("[Email Routing Error]:", err);
    }
}