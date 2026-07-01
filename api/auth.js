export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `${req.headers['x-forwarded-proto']}://${req.headers.host}/api/callback`;

  if (!clientId) {
    res.status(500).send('Error: GITHUB_CLIENT_ID is not configured. Please set it in Vercel environment variables.');
    return;
  }

  const state = Math.random().toString(36).substring(2, 15);
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=repo`;

  res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.redirect(authUrl);
}
