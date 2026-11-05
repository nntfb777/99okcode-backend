-- file: schema.sql

-- 1. Bảng lưu thông tin Admin/User
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TEXT
);

-- 2. Bảng lưu mã code thưởng 
CREATE TABLE IF NOT EXISTS codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_value TEXT UNIQUE NOT NULL,
  amount INTEGER DEFAULT 0
);

-- 2. Bảng lưu lịch sử nhập mã code 
CREATE TABLE history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    code_value TEXT,
    used_at TEXT
);

-- Bảng lưu trữ email nhận được từ Email Routing
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT,
  recipient TEXT,
  subject TEXT,
  body TEXT,
  received_at TEXT
);