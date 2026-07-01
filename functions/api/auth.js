export async function onRequest(context) {
  const clientId = context.env.GITHUB_CLIENT_ID;
  const url = new URL(context.request.url);
  const redirectUri = `${url.origin}/api/callback`;

  if (!clientId) {
    return new Response('Error: GITHUB_CLIENT_ID is not configured. Please set it in Cloudflare Pages environment variables.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const state = Math.random().toString(36).substring(2, 15);
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=repo`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
