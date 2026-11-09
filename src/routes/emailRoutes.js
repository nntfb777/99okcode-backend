import { Hono } from 'hono';
import { writeAdminLog } from '../services/logger.js';

const emailRoutes = new Hono();

// Lấy danh sách email đã nhận 
emailRoutes.get('/emails', async (c) => {
    const db = c.get('selectedDB');
    try {
        const { results } = await db.prepare(
            "SELECT id, sender, recipient, subject, body, received_at FROM emails ORDER BY id DESC LIMIT 100"
        ).all();
        
        return c.json({
            success: true,
            emails: results
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách email:", error);
        return c.json({ success: false, message: error.message }, 500);
    }
});


emailRoutes.delete('/emails/:id', async (c) => {
    const db = c.get('selectedDB');
    const id = c.req.param('id');
    try {
        await db.prepare("DELETE FROM emails WHERE id = ?").bind(id).run();
        // Ghi log xóa email
        const details = `Đã xóa email với ID: ${id}`;
        await writeAdminLog(db, c, 'Xóa Email', details);
        return c.json({ success: true, message: "Đã xóa email thành công!" });
    } catch (error) {
        console.error("Lỗi xóa email:", error);
        return c.json({ success: false, message: error.message }, 500);
    }
});


export default emailRoutes;