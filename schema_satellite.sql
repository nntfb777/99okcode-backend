-- file: schema_satellite.sql
-- Dành cho các DB vệ tinh (OKKING, KL99, v.v.)

-- 1. Bảng lưu mã code thưởng của từng site
CREATE TABLE IF NOT EXISTS codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_value TEXT UNIQUE NOT NULL,
  amount INTEGER DEFAULT 0
);

-- 2. Bảng lưu lịch sử nhập mã code của từng site
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    code_value TEXT,
    used_at TEXT
);