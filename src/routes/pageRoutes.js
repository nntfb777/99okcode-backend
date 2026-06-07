import { Hono } from 'hono';

const pages = new Hono();

pages.get('/home', (c) => c.text('Chào mừng đến với hệ thống 99OK'));
pages.get('/dashboard', (c) => c.text('Trang quản trị hệ thống'));

export default pages;