// src/emailWorker.js

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
        } catch (e) {}
        return match;
    });
}

// Chỉ cắt bỏ phần headers rác của email, giữ lại toàn bộ khối HTML/Text bên dưới để render giống Gmail
function cleanRawEmailBody(rawText) {
    if (!rawText) return "";
    const docTypeIndex = rawText.indexOf('<!DOCTYPE html');
    if (docTypeIndex !== -1) return rawText.substring(docTypeIndex).trim();
    
    const htmlIndex = rawText.indexOf('<html');
    if (htmlIndex !== -1) return rawText.substring(htmlIndex).trim();
    
    const separatorIndex = rawText.indexOf('\r\n\r\n');
    const headerEnd = separatorIndex !== -1 ? separatorIndex : rawText.indexOf('\n\n');
    if (headerEnd !== -1) return rawText.substring(headerEnd).trim();
    
    return rawText;
}

export async function handleEmail(message, env, ctx) {
    const sender = message.from;
    const recipient = message.to;
    const rawSubject = message.headers.get("subject") || "Không có tiêu đề";
    const subject = decodeMimeHeader(rawSubject);
    
    const vntime = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).format(new Date());

    const rawBodyText = await new Response(message.raw).text();
    const cleanBody = cleanRawEmailBody(rawBodyText);

    try {
        const db = env.DB_79KING || env.DB_99OK; 
        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, cleanBody, vntime).run();
        
        console.log(`[Email Routing] Lưu email thành công: ${subject}`);
    } catch (err) {
        console.error("[Email Routing Error]:", err);
    }
}