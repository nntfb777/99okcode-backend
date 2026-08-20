export const fetchWorkerApi = async (endpoint, method = 'GET', body = null, env = {}, siteId = '99ok') => {
  const workerUrl = env.WORKER_API_URL || 'linksbackend.nnt79g.workers.dev';
  const secretKey = env.ADMIN_SECRET_KEY || 'Admin@123!';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${secretKey}`,
    'X-Site-ID': siteId
  };

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const response = await fetch(`${workerUrl}${endpoint}`, config);
  return await response.json();
};