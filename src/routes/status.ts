export function handleStatus(request: Request): Response {
	const url = new URL(request.url);
	const repoUrl = `${url.protocol}//${url.host}`;
	const payload = {
		name: "packagist-mirror",
		repository: repoUrl,
		configure: `composer config -g repos.packagist composer ${repoUrl}`,
		lockfile: "composer update --lock",
		admin: `${repoUrl}/admin`,
		hosted: `${repoUrl}/hosted`,
	};

	if (request.headers.get("accept")?.includes("application/json")) {
		return Response.json(payload);
	}

	const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Packagist mirror</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 44rem; margin: 4rem auto; padding: 0 1.25rem; line-height: 1.5; }
    code, pre { font-family: ui-monospace, SFMono-Regular, monospace; }
    pre { padding: 0.85rem 1rem; overflow-x: auto; border-radius: 0.5rem; background: color-mix(in srgb, CanvasText 8%, Canvas); }
  </style>
</head>
<body>
  <h1>Packagist mirror</h1>
  <p>Point Composer at this Worker instead of packagist.org:</p>
  <pre><code>${escapeHtml(payload.configure)}</code></pre>
  <p>Existing lock files still contain GitHub zip URLs. Rewrite them without bumping versions:</p>
  <pre><code>${escapeHtml(payload.lockfile)}</code></pre>
  <p>Admin UI: <a href="/admin/">/admin</a> · hosted packages: <code>/hosted</code></p>
</body>
</html>`;

	return new Response(html, {
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
