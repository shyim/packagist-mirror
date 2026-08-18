const GITHUB_ZIPBALL = /^\/repos\/([^/]+)\/([^/]+)\/zipball\/(.+)$/;

export function originUserAgent(requestUrl: URL, contactEmail: string): string {
	const contact = contactEmail.trim() ? `; mailto=${contactEmail.trim()}` : "";
	return `packagist-mirror/1.0 (+https://${requestUrl.host}${contact})`;
}

export function normalizeOriginUrl(url: URL): URL {
	if (url.hostname === "api.github.com") {
		const match = url.pathname.match(GITHUB_ZIPBALL);
		if (match) {
			const [, owner, repo, ref] = match;
			return new URL(`https://codeload.github.com/${owner}/${repo}/legacy.zip/${ref}`);
		}
	}
	return url;
}

export function originHeaders(
	requestUrl: URL,
	env: { CONTACT_EMAIL: string; GITHUB_TOKEN?: string },
	target: URL,
	accept?: string,
): Headers {
	const headers = new Headers({
		"user-agent": originUserAgent(requestUrl, env.CONTACT_EMAIL),
	});
	if (accept) {
		headers.set("accept", accept);
	}

	const token = env.GITHUB_TOKEN?.trim();
	if (token && isGitHubHost(target.hostname)) {
		headers.set("authorization", `Bearer ${token}`);
	}

	return headers;
}

function isGitHubHost(hostname: string): boolean {
	return (
		hostname === "api.github.com" ||
		hostname === "github.com" ||
		hostname === "codeload.github.com" ||
		hostname.endsWith(".githubusercontent.com")
	);
}
