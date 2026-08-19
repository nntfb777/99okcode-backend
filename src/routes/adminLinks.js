import { Hono } from 'hono';
import { fetchWorkerApi } from '../services/workerService.js';

const adminLinks = new Hono();

// Lấy danh sách link / banner theo Site ID (Admin View)
adminLinks.get('/list', async (c) => {
  const siteId = c.req.query('site_id') || '99ok';
  const result = await fetchWorkerApi(`/api/admin/links?site_id=${siteId}`, 'GET', null, c.env, siteId);
  return c.json(result);
});

// Thêm mới hoặc Cập nhật Link / Banner
adminLinks.post('/save', async (c) => {
  const body = await c.req.json();
  const siteId = body.site_id || c.req.header('X-Site-ID') || '99ok';
  const result = await fetchWorkerApi('/api/admin/links', 'POST', body, c.env, siteId);
  return c.json(result);
});

// Xóa Link theo key_name
adminLinks.delete('/delete', async (c) => {
  const keyName = c.req.query('key_name');
  const siteId = c.req.query('site_id') || '99ok';
  
  if (!keyName) {
    return c.json({ success: false, error: 'Thiếu tham số key_name' }, 400);
  }
  
  const result = await fetchWorkerApi(`/api/admin/links?key_name=${keyName}&site_id=${siteId}`, 'DELETE', null, c.env, siteId);
  return c.json(result);
});

export default adminLinks;