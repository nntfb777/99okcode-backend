// src/routes/adminLinks.js
import { Hono } from 'hono';
import { fetchWorkerApi } from './workerService.js';
// Import authMiddleware hiện có của Backend để bảo mật trang Admin
import { authMiddleware } from '../middleware/auth.js'; 

const adminLinks = new Hono();

// Lấy danh sách link / banner theo Site ID (Admin View)
adminLinks.get('/list', authMiddleware, async (c) => {
  const siteId = c.req.query('site_id') || '99ok';
  const result = await fetchWorkerApi(`/api/admin/links?site_id=${siteId}`, 'GET', null, siteId);
  return c.json(result);
});

// Thêm mới hoặc Cập nhật Link / Banner
adminLinks.post('/save', authMiddleware, async (c) => {
  const body = await c.req.json();
  const siteId = body.site_id || c.req.header('X-Site-ID') || '99ok';

  const result = await fetchWorkerApi('/api/admin/links', 'POST', body, siteId);
  return c.json(result);
});

// Xóa Link theo key_name
adminLinks.delete('/delete', authMiddleware, async (c) => {
  const keyName = c.req.query('key_name');
  const siteId = c.req.query('site_id') || '99ok';

  if (!keyName) {
    return c.json({ success: false, error: 'Thiếu tham số key_name' }, 400);
  }

  const result = await fetchWorkerApi(`/api/admin/links?key_name=${keyName}&site_id=${siteId}`, 'DELETE', null, siteId);
  return c.json(result);
});

// Route công khai cho Client (Không cần authMiddleware) để render ngoài Frontend
adminLinks.get('/public-config', async (c) => {
  const siteId = c.req.query('site_id') || '99ok';
  const result = await fetchWorkerApi(`/api/config?site_id=${siteId}`, 'GET', null, siteId);
  return c.json(result);
});

export default adminLinks;