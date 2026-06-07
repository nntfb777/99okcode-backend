import { Hono } from 'hono';
import { sign } from 'hono/jwt';
const manaRoutes = new Hono();

// --- HELPER: Hàm băm mật khẩu SHA-256 (Bảo mật cơ bản cho Worker) ---
async function hashPassword(password) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- MIDDLEWARE GIẢ ĐỊNH: Kiểm tra Token ---
// Sếp cần đảm bảo auth.js của sếp đã đính kèm thông tin user vào context (c.get('user'))
const checkSuperAdmin = async (c, next) => {
    const user = c.get('jwtPayload');
    // Thêm kiểm tra !user để tránh lỗi sập server
    if (!user || user.role !== 'superadmin') {
        return c.json({ success: false, message: "Quyền hạn không đủ!" }, 403);
    }
    await next();
};

// 1. LẤY DANH SÁCH ADMIN (Chỉ SuperAdmin)
manaRoutes.get('/accounts', checkSuperAdmin, async (c) => {
    const db = c.get('selectedDB');
    const { results } = await db.prepare("SELECT id, username, role, created_at FROM users").all();
    return c.json({ success: true, data: results });
});

// 2. THÊM ADMIN MỚI (Chỉ SuperAdmin)
manaRoutes.post('/accounts/add', checkSuperAdmin, async (c) => {
    const db = c.get('selectedDB');
    const { username, password, role } = await c.req.json();

    if (!username || !password) return c.json({ success: false, message: "Thiếu thông tin!" });

    const hashed = await hashPassword(password);
    const now = new Date().toISOString().split('T')[0];

    try {
        await db.prepare("INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, ?)")
                .bind(username, hashed, role || 'admin', now)
                .run();
        return c.json({ success: true, message: "Thêm thành công!" });
    } catch (e) {
        return c.json({ success: false, message: "Tên đăng nhập đã tồn tại!" });
    }
});

// 3. XÓA ADMIN (Chỉ SuperAdmin)
manaRoutes.delete('/accounts/delete', checkSuperAdmin, async (c) => {
    const db = c.get('selectedDB');
    const { username } = await c.req.json();
    const currentUser = c.get('jwtPayload').username;

    if (username === currentUser) {
        return c.json({ success: false, message: "Sếp không thể tự xóa chính mình!" });
    }

    await db.prepare("DELETE FROM users WHERE username = ? AND role != 'superadmin'").bind(username).run();
    return c.json({ success: true, message: "Đã xóa tài khoản!" });
});

// 4. TỰ ĐỔI MẬT KHẨU (Cho mọi Admin)
manaRoutes.post('/accounts/change-password', async (c) => {
    const db = c.get('selectedDB');
    const { username, oldPass, newPass } = await c.req.json();
    const currentUser = c.get('jwtPayload').username;

    const payload = c.get('jwtPayload');
        if (!payload) {
            return c.json({ success: false, message: "Phiên làm việc hết hạn hoặc không có quyền!" }, 401);
        }
    if (!username || !oldPass || !newPass) {
        return c.json({ success: false, message: "Dữ liệu gửi lên bị thiếu!" }, 400);
    }

    if (username !== currentUser) {
        return c.json({ success: false, message: "Không có quyền đổi mật khẩu người khác!" });
    }

    const hashedOld = await hashPassword(oldPass);
    const user = await db.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
                   .bind(username, hashedOld).first();

    if (!user) return c.json({ success: false, message: "Mật khẩu cũ không chính xác!" });

    const hashedNew = await hashPassword(newPass);
    await db.prepare("UPDATE users SET password = ? WHERE username = ?")
            .bind(hashedNew, username).run();

    return c.json({ success: true, message: "Đổi mật khẩu thành công!" });
});

// 5. RESET MẬT KHẨU (Chỉ SuperAdmin làm cho nhân viên)
manaRoutes.post('/accounts/reset-password', checkSuperAdmin, async (c) => {
    const db = c.get('selectedDB');
    const { targetUser, newPass } = await c.req.json();

    const hashedNew = await hashPassword(newPass);
    await db.prepare("UPDATE users SET password = ? WHERE username = ?")
            .bind(hashedNew, targetUser).run();

    return c.json({ success: true, message: "Đã reset mật khẩu cho " + targetUser });
});

export default manaRoutes;