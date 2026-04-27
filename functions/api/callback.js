export async function onRequest(context) {
  const clientId = context.env.GITHUB_CLIENT_ID;
  const clientSecret = context.env.GITHUB_CLIENT_SECRET;

  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) return new Response('No code', { status: 400 });

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/callback`
    })
  });

  const data = await tokenRes.json();

  const script = `
    <script>
      window.opener.postMessage(
        'authorization:github:success:${JSON.stringify({
          token: data.access_token,
          provider: 'github'
        })}',
        window.location.origin
      );
      window.close();
    </script>
  `;

  return new Response(script, {
    headers: { 'Content-Type': 'text/html' }
  });
}
