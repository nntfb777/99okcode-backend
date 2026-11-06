// src/emailWorker.js

// Giải mã Quoted-Printable thành byte, rồi decode theo charset (đúng cho tiếng Việt UTF-8)
function decodeQuotedPrintable(str, charset = 'utf-8', isHeader = false) {
    let input = isHeader ? str.replace(/_/g, ' ') : str.replace(/=\r?\n/g, '');
    const encoder = new TextEncoder();
    const bytes = [];

    for (let i = 0; i < input.length; i++) {
        const hex = input.substr(i + 1, 2);
        if (input[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
            bytes.push(parseInt(hex, 16));
            i += 2;
        } else {
            for (const b of encoder.encode(input[i])) bytes.push(b);
        }
    }

    try {
        return new TextDecoder(charset).decode(new Uint8Array(bytes));
    } catch (e) {
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }
}

function decodeMimeHeader(headerValue) {
    if (!headerValue) return "Không có tiêu đề";

    // Các đoạn mã hóa liền nhau: khoảng trắng giữa chúng phải bị bỏ
    const joined = headerValue.replace(/(\?=)\s+(=\?)/g, '$1$2');

    const mimeRegex = /=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g;
    return joined.replace(mimeRegex, (match, charset, encoding, text) => {
        try {
            if (encoding.toUpperCase() === 'B') {
                const binaryString = atob(text);
                const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
                return new TextDecoder(charset).decode(bytes);
            }
            // Kiểu Q (trước đây bị bỏ qua)
            return decodeQuotedPrintable(text, charset, true);
        } catch (e) {}
        return match;
    });
}

// Cắt lấy phần body HTML sạch sẽ
function extractHtmlBody(rawText) {
    if (!rawText) return "";

    let decoded = rawText;

    // Chỉ giải mã khi mail thật sự dùng Quoted-Printable
    if (/content-transfer-encoding:\s*quoted-printable/i.test(rawText)) {
        const charsetMatch = rawText.match(/charset="?([\w-]+)"?/i);
        const charset = charsetMatch ? charsetMatch[1] : 'utf-8';
        decoded = decodeQuotedPrintable(rawText, charset);
    }

    // Tìm thẻ <body> để chỉ lấy nội dung bên trong
    const bodyStartMatch = decoded.match(/<body[^>]*>/i);
    if (bodyStartMatch) {
        const startIndex = decoded.indexOf(bodyStartMatch[0]) + bodyStartMatch[0].length;
        const bodyEndIndex = decoded.lastIndexOf('</body>');
        if (bodyEndIndex !== -1 && bodyEndIndex > startIndex) {
            return decoded.substring(startIndex, bodyEndIndex).trim();
        }
        return decoded.substring(startIndex).trim();
    }

    return decoded;
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
        hourCycle: 'h23'
    }).format(new Date());

    const rawBodyText = await new Response(message.raw).text();
    const cleanHtmlBody = extractHtmlBody(rawBodyText);

    try {
        const db = env.DB_79KING || env.DB_99OK;
        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, cleanHtmlBody, vntime).run();

        console.log(`[Email Routing] Lưu email sạch thành công: ${subject}`);
    } catch (err) {
        console.error("[Email Routing Error]:", err);
    }
}