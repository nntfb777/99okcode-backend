// src/emailWorker.js

// 1. Hàm giải mã tiêu đề MIME (=?UTF-8?B?...?=)
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

// 2. Hàm trích xuất phần nội dung chính từ email thô (Loại bỏ bớt rác headers và boundary)
async function extractEmailBody(rawText) {
    try {
        // Tìm dòng trống phân cách giữa Header và Body của email
        const separatorIndex = rawText.indexOf('\r\n\r\n');
        const headerEnd = separatorIndex !== -1 ? separatorIndex : rawText.indexOf('\n\n');
        
        if (headerEnd === -1) return rawText; // Trả về nguyên bản nếu không tìm thấy phân cách
        
        const headers = rawText.substring(0, headerEnd);
        let body = rawText.substring(headerEnd);

        // Kiểm tra xem email có dùng Multipart (chia nhiều phần text/html) không
        const contentTypeMatch = headers.match(/Content-Type:\s*([^;\r\n]+)/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : '';

        if (contentType.includes('multipart/')) {
            // Tìm ranh giới (boundary) của các phần
            const boundaryMatch = headers.match(/boundary="?([^"\r\n]+)"?/i);
            if (boundaryMatch) {
                const boundary = boundaryMatch[1];
                const parts = body.split('--' + boundary);
                
                // Ưu tiên tìm phần có nội dung text/plain hoặc text/html sạch
                for (const part of parts) {
                    if (part.includes('Content-Type: text/plain')) {
                        const subSplit = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n');
                        if (subSplit !== -1) {
                            let cleanText = part.substring(subSplit).trim();
                            // Giải mã quoted-printable cơ bản nếu cần (=C6=A1 -> ơi)
                            cleanText = decodeQuotedPrintable(cleanText);
                            return cleanText;
                        }
                    }
                }
                
                // Nếu không có text/plain, thử tìm text/html
                for (const part of parts) {
                    if (part.includes('Content-Type: text/html')) {
                        const subSplit = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n');
                        if (subSplit !== -1) {
                            let cleanHtml = part.substring(subSplit).trim();
                            cleanHtml = decodeQuotedPrintable(cleanHtml);
                            return cleanHtml;
                        }
                    }
                }
            }
        } else if (headers.includes('Content-Transfer-Encoding: quoted-printable')) {
            body = decodeQuotedPrintable(body);
        }

        return body.trim();
    } catch (e) {
        console.error("Lỗi trích xuất nội dung email:", e);
        return rawText; // Fallback trả về nguyên bản nếu lỗi
    }
}

// 3. Hàm giải mã định dạng Quoted-Printable (=C6=A1 -> ký tự tiếng Việt)
function decodeQuotedPrintable(str) {
    try {
        // Xử lý xuống dòng mềm (= \r\n hoặc = \n)
        let cleaned = str.replace(/=\r?\n/g, '');
        // Chuyển đổi mã hex =XX thành mảng byte để decode chuẩn UTF-8
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

    // Đọc nội dung thô và qua hàm lọc nội dung sạch
    const rawStream = message.raw;
    const rawBodyText = await new Response(rawStream).text();
    const cleanBody = await extractEmailBody(rawBodyText);

    try {
        const db = env.DB_79KING || env.DB_99OK; 

        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, cleanBody, vntime).run();

        console.log(`[Email Routing] Đã bóc tách và lưu email thành công: ${subject}`);
    } catch (err) {
        console.error("[Email Routing Error] Không thể lưu email vào D1:", err);
    }
}