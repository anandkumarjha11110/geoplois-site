export async function onRequest(context) {
  const clientId = context.env.GITHUB_CLIENT_ID;
  const clientSecret = context.env.GITHUB_CLIENT_SECRET;

  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  // Exchange code for token
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/callback`
    })
  });

  const data = await res.json();

  if (!data.access_token) {
    return new Response('No access token', { status: 500 });
  }

  // ✅ VERY IMPORTANT FIX (Decap expected format)
  const script = `
    <script>
      (function() {
        function receiveMessage(e) {
          console.log("CMS auth success");
        }
        window.opener.postMessage(
          'authorization:github:success:${data.access_token}',
          '*'
        );
        window.close();
      })();
    </script>
  `;

  return new Response(script, {
    headers: { 'Content-Type': 'text/html' }
  });
}
