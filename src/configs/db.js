// backend/src/configs/db.js

const db = {
  // Hàm để chạy truy vấn SQL
  query: async (env, sql, params = []) => {
    try {
      return await env.DB.prepare(sql).bind(...params).all();
    } catch (error) {
      console.error("D1 Query Error:", error);
      throw error;
    }
  },
  
  // Hàm để lấy 1 dòng duy nhất
  getOne: async (env, sql, params = []) => {
    return await env.DB.prepare(sql).bind(...params).first();
  }
};

export default db;