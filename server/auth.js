function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY not configured on server' });
  }
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
}

module.exports = apiKeyAuth;
