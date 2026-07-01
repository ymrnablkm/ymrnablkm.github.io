export async function onRequest(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const clientId = context.env.GITHUB_CLIENT_ID;
  const clientSecret = context.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response('Error: GitHub OAuth credentials are not configured.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (!code) {
    return new Response('Error: No code provided.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        state: state,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return new Response(`Error: ${data.error_description || data.error}`, {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const token = data.access_token;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>登录成功</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }
    h1 { color: #0f172a; margin: 0 0 16px 0; font-size: 24px; }
    p { color: #64748b; margin: 0 0 24px 0; }
    .btn { display: inline-block; padding: 12px 32px; background: #0f172a; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; }
    .btn:hover { background: #1e293b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>登录成功！</h1>
    <p>正在跳转回管理后台...</p>
    <a href="/admin/" class="btn">点击这里跳转</a>
  </div>
  <script>
    (function() {
      var receiver = window.opener;
      if (receiver) {
        receiver.postMessage({
          from: 'sveltia-cms-auth',
          token: '${token}',
          provider: 'github'
        }, '*');
        window.close();
      } else {
        localStorage.setItem('sveltia-cms-github-token', '${token}');
        setTimeout(function() {
          window.location.href = '/admin/';
        }, 1000);
      }
    })();
  </script>
</body>
</html>
`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
