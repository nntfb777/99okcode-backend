import { Hono } from 'hono';

const admin = new Hono();

admin.get('/list-codes', async (c) => {
  try {
    const { results } = await c.get('selectedDB').prepare(
      "SELECT id, code_value, amount FROM codes ORDER BY id DESC"
    ).all();
    
    return c.json({ 
      success: true, 
      codes: results // Trả về key 'codes' để khớp với hàm loadCodes trong JS
    });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// 2. Tạo mã code mới
admin.post('/generate-code', async (c) => {
  try {
    const { code_value, amount } = await c.req.json();
    
    if (!code_value) {
        return c.json({ success: false, message: 'Thiếu mã code' }, 400);
    }

    const finalCode = code_value.trim().toUpperCase().substring(0, 15);
    await c.get('selectedDB').prepare(
      "INSERT INTO codes (code_value, amount) VALUES (?, ?)"
    )
    .bind(finalCode, amount || 1)
    .run();

    return c.json({ success: true, message: 'Tạo mã thành công' });
  } catch (error) {
    // Thường lỗi do trùng UNIQUE mã code trong Database
    return c.json({ success: false, message: 'Mã code đã tồn tại hoặc lỗi SQL' }, 400);
  }
});

// 3. Xóa mã code
admin.delete('/delete-code/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.get('selectedDB').prepare("DELETE FROM codes WHERE id = ?").bind(id).run();
    return c.json({ success: true, message: 'Đã xóa mã' });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

admin.post('/generate-code-bulk', async (c) => {
  const db = c.get('selectedDB');
  try {
    const { codes } = await c.req.json();
    
    if (!codes || !Array.isArray(codes)) {
      return c.json({ success: false, message: 'Dữ liệu không hợp lệ' }, 400);
    }

    // Tối ưu Batch Insert chuẩn biến của sếp
    const statements = codes.map(item => {
      // Mặc định là 1 nếu amount không tồn tại hoặc bằng 0/null
      const finalCode = item.code_value.trim().toUpperCase().substring(0, 15);
      const finalAmount = (item.amount && item.amount > 0) ? item.amount : 1;
      
      return db.prepare("INSERT INTO codes (code_value, amount) VALUES (?, ?)")
               .bind(finalCode, finalAmount);
    });

    await db.batch(statements);
    
    return c.json({ 
      success: true, 
      message: `Đã nhập thành công ${codes.length} mã!` 
    });
  } catch (error) {
    console.error("Lỗi bulk:", error);
    return c.json({ success: false, message: "Lỗi: " + error.message }, 500);
  }
});

// 3. TÍNH NĂNG MỚI: Xuất danh sách mã (Export)
admin.get('/export-codes', async (c) => {
  try {
    const { results } = await c.get('selectedDB').prepare("SELECT code_value, amount FROM codes").all();
    
    // Tạo nội dung CSV
    let csvContent = "Mã Code,Số lượng\n";
    results.forEach(row => {
      csvContent += `${row.code_value},${row.amount}\n`;
    });

    // Trả về file dưới dạng download
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="danh-sach-ma-99OK.csv"',
      },
    });
  } catch (error) {
    return c.text('Lỗi khi xuất file: ' + error.message, 500);
  }
});

// Xóa nhiều mã cùng lúc
admin.post('/delete-codes-bulk', async (c) => {
  try {
    const { ids } = await c.req.json(); // Nhận mảng [1, 2, 3...]
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ success: false, message: 'Không có mã nào được chọn' }, 400);
    }

    // Tạo câu lệnh xóa hàng loạt bằng dấu hỏi chấm tương ứng số lượng ID
    const placeholders = ids.map(() => '?').join(',');
    await c.get('selectedDB').prepare(`DELETE FROM codes WHERE id IN (${placeholders})`)
      .bind(...ids)
      .run();

    return c.json({ success: true, message: `Đã xóa thành công ${ids.length} mã` });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});



// Worker side - adminRoutes.js
admin.get('/stats', async (c) => {
    const db = c.get('selectedDB');
    const stats = await db.prepare(`
        SELECT 
            (SELECT COUNT(*) FROM codes) as total,
            (SELECT COUNT(*) FROM codes WHERE amount = 0) as used,
            (SELECT COUNT(*) FROM history) as claimed
        FROM codes LIMIT 1
    `).first();
    
    const recentHistory = await db.prepare(`
        SELECT * FROM history ORDER BY id DESC LIMIT 5
    `).all();

    return c.json({ stats, history: recentHistory.results });
});

export default admin;