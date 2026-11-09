// routes/historyRoutes.js
import { Hono } from 'hono';
import { writeAdminLog } from '../services/logger.js';
const history = new Hono();

// Lấy danh sách lịch sử
history.get('/', async (c) => {
    const db = c.get('selectedDB');
    try {
        // QUAN TRỌNG: Phải SELECT thêm cột 'id' để Frontend dùng checkbox
        const { results } = await db.prepare(
            "SELECT id, username, code_value, used_at, ip, ua, canvas_fp FROM history ORDER BY id DESC"
        ).all();

        return c.json({
            success: true,
            data: results
        });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

// Xóa hàng loạt
history.post('/delete-bulk', async (c) => {
    const db = c.get('selectedDB');
    try {
        const { ids } = await c.req.json();
        if (!ids || ids.length === 0) return c.json({ success: false, message: "Không có ID nào!" });

        const placeholders = ids.map(() => "?").join(",");
        await db.prepare(`DELETE FROM history WHERE id IN (${placeholders})`)
                .bind(...ids)
                .run();
        
        // Ghi log xóa hàng loạt
        const details = `Đã xóa ${ids.length} mục lịch sử.`;
        await writeAdminLog(db, c, 'Xóa Lịch Sử', details);

        return c.json({ success: true, message: `Đã xóa thành công ${ids.length} mục lịch sử!` });
    } catch (err) {
        return c.json({ success: false, message: "Lỗi Backend: " + err.message }, 500);
    }
});

// 3. Dọn sạch toàn bộ (Dành cho nút Dọn trống)
history.post('/clear-all', async (c) => {
    const db = c.get('selectedDB');
    try {
        await db.prepare("DELETE FROM history").run();
        // Reset ID về 1
        await db.prepare("DELETE FROM sqlite_sequence WHERE name='history'").run();
        // Ghi log dọn sạch
        await writeAdminLog(db, c, 'Dọn Sạch Lịch Sử', 'Đã dọn sạch toàn bộ lịch sử trong bảng history.');
        return c.json({ success: true, message: "Đã dọn sạch toàn bộ lịch sử!" });
    } catch (err) {
        return c.json({ success: false, message: "Lỗi dọn rác: " + err.message }, 500);
    }
});


export default history;