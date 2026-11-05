// src/emailWorker.js

// Hàm giải mã tiêu đề MIME (=?UTF-8?B?...?=)
function decodeMimeHeader(headerValue) {
    if (!headerValue) return "Không có tiêu đề";
    const mimeRegex = /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi;
    return headerValue.replace(mimeRegex, (match, charset, encoding, text) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                const binaryString = atob(text);
                const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
                return new TextDecoder(charset).decode(bytes);
            }
        } catch (e) {
            console.error("Lỗi giải mã MIME header:", e);
        }
        return match;
    });
}

export async function handleEmail(message, env, ctx) {
    const sender = message.from;
    const recipient = message.to;
    
    // Lấy tiêu đề và giải mã
    const rawSubject = message.headers.get("subject") || "Không có tiêu đề";
    const subject = decodeMimeHeader(rawSubject);
    
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

    // Đọc toàn bộ nội dung thô (Raw Body) nguyên bản để lưu vào DB
    const rawBodyText = await new Response(message.raw).text();

    try {
        const db = env.DB_79KING || env.DB_99OK; 

        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, rawBodyText, vntime).run();

        console.log(`[Email Routing] Đã lưu thành công raw email: ${subject}`);
    } catch (err) {
        console.error("[Email Routing Error] Không thể lưu email vào D1:", err);
    }
}