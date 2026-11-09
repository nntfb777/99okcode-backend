// src/services/logger.js
export async function writeAdminLog(db, c, action, details = '') {
    // Lấy thông tin từ jwtPayload (Hono JWT middleware thường lưu payload vào c.get('jwtPayload') hoặc c.get('jwt'))
    const payload = c.get('jwtPayload') || c.get('jwt') || {};
    const username = payload.username || c.req.header('X-Admin-Name') || 'Unknown';
    const clientIP = c.req.header('CF-Connecting-IP') || 'Unknown';
    
    const vntime = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date());

    try {
        await db.prepare(
            "INSERT INTO admin_logs (username, action, details, ip, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(username, action, details, clientIP, vntime).run();
    } catch (e) {
        console.error("Lỗi ghi log:", e);
    }
}