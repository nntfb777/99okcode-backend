import { Hono } from 'hono';
import { fetchWorkerApi } from '../services/workerService.js';
import { writeAdminLog } from '../services/logger.js';

const adminLinks = new Hono();

// Lấy danh sách link / banner theo Site ID (Admin View)
adminLinks.get('/list', async (c) => {
  const siteId = c.req.query('site_id') || '99ok';
  const result = await fetchWorkerApi(`/api/admin/links?site_id=${siteId}`, 'GET', null, c.env, siteId);
  return c.json(result);
});

// Thêm mới hoặc Cập nhật Link / Banner
adminLinks.post('/save', async (c) => {
    const db = c.get('selectedDB');
    const body = await c.req.json();
    const siteId = body.site_id || c.req.header('X-Site-ID') || '99ok';
    const { key_name, value, category } = body;
    
    // Thực hiện gọi Worker API lưu link như cũ
    const result = await fetchWorkerApi('/api/admin/links', 'POST', body, c.env, siteId);

    // 📝 GHI LOG THAO TÁC ADMIN
    if (result.success && result.changedCount > 0) {
        const actionName = body.category === 'banner_image' ? 'Cập nhật Banner' : 
                           body.category === 'ping_link' ? 'Cập nhật Master URL' : 
                           'Cập nhật Link Hệ Thống/MXH';
        
        const details = `Site: [${siteId.toUpperCase()}] - Mục: [${body.key_name}] -> Giá trị: ${body.value}`;
        
        // Gọi hàm ghi log vào Database chính
        const mainDb = c.get('selectedDB');
        await writeAdminLog(mainDb, c, actionName, details);
    }

    return c.json(result);
});


// Xóa Link theo key_name (Hiển thị rõ link nào đã bị xóa trong log)
adminLinks.delete('/delete', async (c) => {
    const keyName = c.req.query('key_name');
    const siteId = c.req.query('site_id') || '99ok';
    
    if (!keyName) {
        return c.json({ success: false, error: 'Thiếu tham số key_name' }, 400);
    }

    // 1. Lấy danh sách link hiện tại trước khi xóa để tìm ra giá trị (value) của key chuẩn bị xóa
    const currentDataRes = await fetchWorkerApi(`/api/admin/links?site_id=${siteId}`, 'GET', null, c.env, siteId);
    const existingItems = currentDataRes.data || [];
    const itemToDelete = existingItems.find(i => i.key_name === keyName);
    const deletedValue = itemToDelete ? itemToDelete.value : 'Không rõ URL';

    // 2. Thực hiện gọi Worker API để xóa key khỏi Database
    const result = await fetchWorkerApi(`/api/admin/links?key_name=${keyName}&site_id=${siteId}`, 'DELETE', null, c.env, siteId);

    // 3. GHI LOG VỚI CHI TIẾT CỤ THỂ ĐƯỜNG DẪN BỊ XÓA
    if (result && result.success) {
        const categoryName = itemToDelete ? itemToDelete.category : 'link';
        const actionName = categoryName === 'banner_image' ? 'Xóa Banner' : categoryName === 'ping_link' ? 'Xóa Master URL' : 'Xóa Đường Dẫn';
        
        // Ghi cực kỳ rõ ràng: Ai xóa, site nào, key gì và đường dẫn cụ thể là gì
        const details = `Site: [${siteId.toUpperCase()}] - Xóa [${keyName}]: "${deletedValue}"`;
        
        const mainDb = c.get('selectedDB');
        await writeAdminLog(mainDb, c, actionName, details);
    }

    return c.json(result);
});
export default adminLinks;