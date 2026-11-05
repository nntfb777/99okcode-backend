import { Hono } from 'hono';

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

export default emailRoutes;