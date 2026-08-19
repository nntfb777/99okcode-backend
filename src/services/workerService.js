// src/services/workerService.js
const WORKER_URL = process.env.WORKER_API_URL || 'linksbackend.nnt79g.workers.dev';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'Admin@123!';

export const fetchWorkerApi = async (endpoint, method = 'GET', body = null, siteId = '99ok') => {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ADMIN_SECRET_KEY}`,
    'X-Site-ID': siteId
  };

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const response = await fetch(`${WORKER_URL}${endpoint}`, config);
  return await response.json();
};