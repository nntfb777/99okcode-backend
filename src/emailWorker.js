// src/emailWorker.js

const MAX_BODY_CHARS = 900000; // giữ dưới giới hạn ~2MB/dòng của D1

// ---------- Giải mã cơ bản ----------

function safeDecode(bytes, charset) {
    try {
        return new TextDecoder(charset || 'utf-8').decode(bytes);
    } catch (e) {
        return new TextDecoder('utf-8').decode(bytes);
    }
}

// Quoted-Printable -> byte -> decode theo charset (đúng cho tiếng Việt UTF-8)
function decodeQuotedPrintable(str, charset = 'utf-8', isHeader = false) {
    const input = isHeader ? str.replace(/_/g, ' ') : str.replace(/=\r?\n/g, '');
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
    return safeDecode(new Uint8Array(bytes), charset);
}

function decodeBase64(str, charset = 'utf-8') {
    const bin = atob(str.replace(/\s+/g, ''));
    return safeDecode(Uint8Array.from(bin, c => c.charCodeAt(0)), charset);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function decodeMimeHeader(headerValue) {
    if (!headerValue) return "Không có tiêu đề";

    // Các đoạn mã hóa liền nhau: khoảng trắng giữa chúng phải bị bỏ
    const joined = headerValue.replace(/(\?=)\s+(=\?)/g, '$1$2');

    return joined.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (match, charset, encoding, text) => {
        try {
            if (encoding.toUpperCase() === 'B') return decodeBase64(text, charset);
            return decodeQuotedPrintable(text, charset, true);
        } catch (e) {}
        return match;
    });
}

// ---------- Phân tích MIME ----------

// Tách header và body của một phần (dòng trống đầu tiên). Header đã được gộp dòng gập.
function splitHeadersBody(text) {
    // Phần không có header: bắt đầu bằng dòng trống
    const lead = text.match(/^\r?\n/);
    if (lead) return { headers: '', body: text.substring(lead[0].length) };

    const m = text.match(/\r?\n\r?\n/);
    if (!m) return { headers: text.replace(/\r?\n[ \t]+/g, ' '), body: '' };

    return {
        headers: text.substring(0, m.index).replace(/\r?\n[ \t]+/g, ' '),
        body: text.substring(m.index + m[0].length)
    };
}

function getHeader(headers, name) {
    const m = headers.match(new RegExp('^' + name + ':[ \\t]*(.*)$', 'im'));
    return m ? m[1].trim() : '';
}

function decodePartBody(headers, body) {
    const charset = (getHeader(headers, 'content-type').match(/charset="?([\w-]+)"?/i) || [])[1] || 'utf-8';
    const encoding = getHeader(headers, 'content-transfer-encoding').toLowerCase();
    try {
        if (encoding === 'quoted-printable') return decodeQuotedPrintable(body, charset);
        if (encoding === 'base64') return decodeBase64(body, charset);
    } catch (e) {
        console.error("[Email] Lỗi giải mã:", e);
    }
    return body;
}

// Tìm phần có kiểu `wanted` (text/html hoặc text/plain), đệ quy qua multipart lồng nhau.
// Trả về chuỗi đã giải mã, hoặc null nếu không có.
function findPart(text, wanted) {
    const { headers, body } = splitHeadersBody(text);
    const contentType = getHeader(headers, 'content-type');
    const type = contentType.split(';')[0].trim().toLowerCase();

    if (type.startsWith('multipart/')) {
        const boundary = (contentType.match(/boundary="?([^";]+)"?/i) || [])[1];
        if (!boundary) return null;

        const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const splitter = new RegExp('(?:^|\\r?\\n)--' + escaped + '(?:--)?[ \\t]*(?=\\r?\\n|$)');
        const parts = body.split(splitter);

        // parts[0] là phần mở đầu (preamble), bỏ qua
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i].replace(/^\r?\n/, ''); // bỏ dòng xuống ngay sau dòng boundary
            if (!part.trim()) continue;
            const found = findPart(part, wanted);
            if (found !== null) return found;
        }
        return null;
    }

    // Bỏ qua file đính kèm
    if (/attachment/i.test(getHeader(headers, 'content-disposition'))) return null;

    if (type === wanted) return decodePartBody(headers, body);
    return null;
}

// Lấy phần nội dung HTML sạch sẽ, hỗ trợ multipart lồng nhiều tầng
function extractHtmlBody(rawText) {
    if (!rawText) return "";

    let decoded = findPart(rawText, 'text/html');

    if (decoded === null) {
        // Không có HTML: dùng text/plain, bọc trong <pre> để giữ xuống dòng
        const plain = findPart(rawText, 'text/plain');
        if (plain !== null) {
            return `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(plain.trim())}</pre>`;
        }
        // Mail không khai báo Content-Type: giải mã phần body theo header chính
        const { headers, body } = splitHeadersBody(rawText);
        decoded = decodePartBody(headers, body);
    }

    // Lấy phần bên trong <body> nếu có
    const bodyStartMatch = decoded.match(/<body[^>]*>/i);
    if (bodyStartMatch) {
        const startIndex = bodyStartMatch.index + bodyStartMatch[0].length;
        const bodyEndIndex = decoded.toLowerCase().lastIndexOf('</body>');
        if (bodyEndIndex > startIndex) {
            return decoded.substring(startIndex, bodyEndIndex).trim();
        }
        return decoded.substring(startIndex).trim();
    }

    return decoded.trim();
}

// ---------- Handler nhận mail ----------

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

    try {
        const rawBodyText = await new Response(message.raw).text();
        const cleanHtmlBody = extractHtmlBody(rawBodyText).slice(0, MAX_BODY_CHARS);

        const db = env.DB_79KING || env.DB_99OK;
        await db.prepare(
            `INSERT INTO emails (sender, recipient, subject, body, received_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(sender, recipient, subject, cleanHtmlBody, vntime).run();

        console.log(`[Email Routing] Lưu email sạch thành công: ${subject}`);
    } catch (err) {
        console.error("[Email Routing Error]:", err);
    }
}