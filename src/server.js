import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { jwt } from 'hono/jwt';

import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import historyRoutes from './routes/historyRoutes';
import clientRoutes from './routes/clientRoutes';
import pageRoutes from './routes/pageRoutes';
import manaRoutes from './routes/manaRoutes';
import adminLinks from './routes/adminLinks';
const app = new Hono();

app.use('*', logger());
app.use('*', secureHeaders());

// CẤU HÌNH CORS CHUẨN
app.use('*', cors({
  origin: (origin) => {
    // Cho phéptrang admin và trang khách
    const allowedOrigins = [
      'http://localhost:5500',
      'https://99okcode-admin.pages.dev',
      'https://99okcode.pages.dev',
      'https://79kingcode.pages.dev',
      'https://okkingcode.pages.dev',
      'https://kl99code.pages.dev',
    ];
    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Site-ID'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

const dbSwitcher = async (c, next) => {
    // 1. Lấy Site ID từ Header (Frontend sẽ gửi cái này lên)
    const path = c.req.path;
    const siteId = c.req.header('X-Site-ID'); 

    if (path.includes('/login') || path.includes('/accounts')) {
        c.set('selectedDB', c.env.DB_99OK);
        return await next();
    }
    
    // 2. Dựa vào Site ID để chọn Binding tương ứng
    let db;
    switch (siteId) {
        case '99ok':
            db = c.env.DB_99OK;
            break;
        case 'okking':
            db = c.env.DB_OKKING;
            break;
        case 'kl99':
            db = c.env.DB_KL99;
            break;
        case '79king':
            db = c.env.DB_79KING;
            break;
        default:
            // Nếu không gửi siteId hoặc siteId lạ, trả về lỗi luôn
            return c.json({ success: false, message: "Site ID không hợp lệ!" }, 400);
    }

    // 3. Gán DB đã chọn vào Context (c) để các Route sau này sử dụng
    c.set('selectedDB', db);
    
    await next();
};

// Áp dụng cho tất cả các route
app.use('*', dbSwitcher);


app.use('/api/admin/*', (c, next) => {
  if (c.req.path === '/api/admin/login') return next();
  return jwt({ 
    secret: c.env.JWT_SECRET,
    alg: 'HS256' 
  })(c, next);
});

// Các tuyến đường
app.route('/', pageRoutes);
app.route('/api/admin', authRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/history', historyRoutes);
app.route('/a/c', clientRoutes);
app.route('/api/admin', manaRoutes);
app.route('/api/admin/links', adminLinks);

app.onError((err, c) => {
  console.error(`Lỗi hệ thống: ${err.message}`);
  return c.json({
    success: false,
    message: 'Đã có lỗi xảy ra tại server Cloudflare',
    error: err.message
  }, 500);
});

export default app;