-- file: schema.sql

-- 1. Bảng lưu thông tin Admin/User
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TEXT
);

-- 2. Bảng lưu mã code thưởng (Giống dự án 99ok sếp đang làm)
CREATE TABLE IF NOT EXISTS codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_value TEXT UNIQUE NOT NULL,
  amount INTEGER DEFAULT 0
);

-- 2. Bảng lưu lịch sử nhập mã code (Để sếp dễ quản lý)
CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    code_value TEXT,
    used_at TEXT
);