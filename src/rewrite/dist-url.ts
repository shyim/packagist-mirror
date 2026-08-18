const DIST_PREFIX = "/dist/https/";

export function toDistPath(
	raw: string,
	isAllowed: (host: string) => boolean,
	publicOrigin: string,
): string | null {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}

	if (url.protocol !== "https:") {
		return null;
	}
	if (!isAllowed(url.hostname)) {
		return null;
	}

	const path = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
	return `${publicOrigin}${DIST_PREFIX}${url.host}/${path}${url.search}`;
}

export function parseDistRequest(pathname: string, search: string): URL | null {
	if (!pathname.startsWith(DIST_PREFIX)) {
		return null;
	}

	const rest = pathname.slice(DIST_PREFIX.length);
	const slash = rest.indexOf("/");
	if (slash <= 0) {
		return null;
	}

	const host = rest.slice(0, slash);
	const path = rest.slice(slash);
	try {
		return new URL(`https://${host}${path}${search}`);
	} catch {
		return null;
	}
}
