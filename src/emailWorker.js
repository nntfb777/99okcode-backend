// src/emailWorker.js

// 1. Giải mã tiêu đề MIME
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

// 2. Giải mã Quoted-Printable (=C6=A1 -> ký tự tiếng Việt)
function decodeQuotedPrintable(str) {
    try {
        let cleaned = str.replace(/=\r?\n/g, '');
        const hexRegex = /=([A-Fa-f0-9]{2})/g;
        const bytes = [];
        let lastIdx = 0;
        let match;

        while ((match = hexRegex.exec(cleaned)) !== null) {
            bytes.push(...new TextEncoder().encode(cleaned.substring(lastIdx, match.index)));
            bytes.push(parseInt(match[1], 16));
            lastIdx = hexRegex.lastIndex;
        }
        bytes.push(...new TextEncoder().encode(cleaned.substring(lastIdx)));

        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch (e) {
        return str;
    }
}

// 3. Giải mã Base64 an toàn cho nội dung text
function decodeBase64(str) {
    try {
        const binaryString = atob(str.replace(/\s/g, ''));
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
        return str;
    }
}

// 4. Trích xuất và làm sạch nội dung email
async function extractEmailBody(rawText) {
    try {
        const separatorIndex = rawText.indexOf('\r\n\r\n');
        const headerEnd = separatorIndex !== -1 ? separatorIndex : rawText.indexOf('\n\n');
        
        if (headerEnd === -1) return rawText;
        
        const headers = rawText.substring(0, headerEnd);
        let body = rawText.substring(headerEnd);

        const contentTypeMatch = headers.match(/Content-Type:\s*([^;\r\n]+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : '';

        // Nếu là định dạng Multipart, ta bóc tách từng phần (Boundary)
        if (contentType.includes('multipart/')) {
            const boundaryMatch = headers.match(/boundary="?([^"\r\n]+)"?/i);
            if (boundaryMatch) {
                const boundary = boundaryMatch[1];
                const parts = body.split('--' + boundary);
                
                // Ưu tiên 1: Tìm phần chứa text/plain
                for (const part of parts) {
                    if (part.includes('Content-Type: text/plain')) {
                        const subSplit = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n');
                        if (subSplit !== -1) {
                            let content = part.substring(subSplit).trim();
                            // Kiểm tra xem có bị mã hóa base64 không
                            if (part.includes('Content-Transfer-Encoding: base64')) {
                                content = decodeBase64(content);
                            } else if (part.includes('Content-Transfer-Encoding: quoted-printable')) {
                                content = decodeQuotedPrintable(content);
                            }
                            return content.trim();
                        }
                    }
                }
                
                // Ưu tiên 2: Tìm phần chứa text/html nếu không có text/plain
                for (const part of parts) {
                    if (part.includes('Content-Type: text/html')) {
                        const subSplit = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n');
                        if (subSplit !== -1) {
                            let content = part.substring(subSplit).trim();
                            if (part.includes('Content-Transfer-Encoding: base64')) {
                                content = decodeBase64(content);
                            } else if (part.includes('Content-Transfer-Encoding: quoted-printable')) {
                                content = decodeQuotedPrintable(content);
                            }
                            // Lọc bỏ bớt thẻ HTML cơ bản nếu muốn hiện chữ thuần, hoặc giữ nguyên
                            return content.replace(/<[^>]*>/g, '').trim();
                        }
                    }
                }
            }
        } 
        
        // Xử lý email đơn (không phải multipart)
        if (headers.includes('Content-Transfer-Encoding: base64')) {
            body = decodeBase64(body);
        } else if (headers.includes('Content-Transfer-Encoding: quoted-printable')) {
            body = decodeQuotedPrintable(body);
        }

        return body.replace(/<[^>]*>/g, '').trim();
    } catch (e) {
        console.error("Lỗi trích xuất nội dung email:", e);
        return rawText;
    }
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

    const rawStream = message.raw;
    const rawBodyText = await new Response(rawStream).text();
    const cleanBody = await extractEmailBody(rawBodyText);

    try {
        const db = env.DB_79KING || env.DB_99OK; 

        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, cleanBody, vntime).run();

        console.log(`[Email Routing] Lưu email thành công: ${subject}`);
    } catch (err) {
        console.error("[Email Routing Error] Không thể lưu email vào D1:", err);
    }
}