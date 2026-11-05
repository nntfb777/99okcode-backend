// src/emailWorker.js

// Hàm giải mã tiêu đề MIME
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

// Hàm cắt bỏ phần CSS header rác, chỉ giữ lại từ khối HTML chính trở đi
function cleanEmailRawBody(rawText) {
    if (!rawText) return "";
    
    // Tìm vị trí xuất hiện của thẻ <!DOCTYPE html> hoặc thẻ <html> thực sự của nội dung
    const docTypeIndex = rawText.indexOf('<!DOCTYPE html');
    if (docTypeIndex !== -1) {
        return rawText.substring(docTypeIndex).trim();
    }
    
    const htmlIndex = rawText.indexOf('<html');
    if (htmlIndex !== -1) {
        return rawText.substring(htmlIndex).trim();
    }
    
    // Nếu không tìm thấy, fallback tìm phân cách giữa headers email và body
    const separatorIndex = rawText.indexOf('\r\n\r\n');
    const headerEnd = separatorIndex !== -1 ? separatorIndex : rawText.indexOf('\n\n');
    if (headerEnd !== -1) {
        return rawText.substring(headerEnd).trim();
    }
    
    return rawText;
}

export async function handleEmail(message, env, ctx) {
    const sender = message.from;
    const recipient = message.to;
    
    const rawSubject = message.headers.get("subject") || "Không có tiêu đề";
    const subject = decodeMimeHeader(rawSubject);
    
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

    // Đọc nội dung thô và chạy qua hàm cắt bỏ phần CSS header rác
    const rawBodyText = await new Response(message.raw).text();
    const cleanedBody = cleanEmailRawBody(rawBodyText);

    try {
        const db = env.DB_79KING || env.DB_99OK; 

        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, cleanedBody, vntime).run();

        console.log(`[Email Routing] Đã lưu email sạch thành công: ${subject}`);
    } catch (err) {
        console.error("[Email Routing Error] Không thể lưu email vào D1:", err);
    }
}