import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const auth = new Hono();

async function hashPassword(password) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 1. Tuyến đường Đăng nhập (Login)
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    // Truy vấn trực tiếp từ Cloudflare D1
    const user = await c.get('selectedDB').prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
      .bind(username)
      .first();

    if (!user) {
      return c.json({ success: false, message: 'Tài khoản không tồn tại' }, 404);
    }

    const hashedInput = await hashPassword(password);
    if (user.password !== hashedInput) {
      return c.json({ success: false, message: 'Mật khẩu không đúng' }, 401);
    }
    

    // Tạo mã JWT Token để người dùng đăng nhập các lần sau
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // Hết hạn sau 24h
    };
    
    const token = await sign(payload, c.env.JWT_SECRET);

    return c.json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      role: user.role,
    });

  } catch (error) {
    return c.json({ success: false, message: 'Lỗi xử lý đăng nhập', error: error.message }, 500);
  }
});

// 2. Tuyến đường lấy thông tin cá nhân (Profile)
auth.get('/me', async (c) => {
  // Logic lấy thông tin từ Token (thường dùng qua middleware)
  return c.json({ message: 'Đây là dữ liệu cá nhân của sếp' });
});

export default auth;