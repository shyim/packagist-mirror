type JsonObject = Record<string, unknown>;

export function rewritePackagesJson(upstream: JsonObject, prefix = ""): JsonObject {
	const rewritten: JsonObject = { ...upstream };
	const root = prefix.replace(/\/$/, "");

	rewritten["notify-batch"] = `${root}/downloads/`;
	rewritten["metadata-url"] = `${root}/p2/%package%.json`;
	rewritten["metadata-changes-url"] = `${root}/metadata/changes.json`;
	rewritten.search = `${root}/search.json?q=%query%&type=%type%`;
	rewritten.list = `${root}/packages/list.json`;
	rewritten["providers-api"] = `${root}/providers/%package%.json`;

	const security = upstream["security-advisories"];
	if (isObject(security)) {
		rewritten["security-advisories"] = {
			...security,
			"api-url": `${root}/api/security-advisories/`,
		};
	}

	const filter = upstream.filter;
	if (isObject(filter)) {
		rewritten.filter = {
			...filter,
			"summary-url": `${root}/lists/all/summary.json`,
		};
	}

	return rewritten;
}

export function rewritePackagistAbsoluteUrls(value: unknown): unknown {
	if (typeof value === "string") {
		return rewritePackagistUrl(value);
	}
	if (Array.isArray(value)) {
		return value.map((item) => rewritePackagistAbsoluteUrls(item));
	}
	if (isObject(value)) {
		const next: JsonObject = {};
		for (const [key, nested] of Object.entries(value)) {
			next[key] = rewritePackagistAbsoluteUrls(nested);
		}
		return next;
	}
	return value;
}

export function rewriteRemoteAbsoluteUrls(value: unknown, origins: string[], prefix: string): unknown {
	if (typeof value === "string") {
		return rewriteAgainstOrigins(value, origins, prefix);
	}
	if (Array.isArray(value)) {
		return value.map((item) => rewriteRemoteAbsoluteUrls(item, origins, prefix));
	}
	if (isObject(value)) {
		const next: JsonObject = {};
		for (const [key, nested] of Object.entries(value)) {
			next[key] = rewriteRemoteAbsoluteUrls(nested, origins, prefix);
		}
		return next;
	}
	return value;
}

function rewritePackagistUrl(value: string): string {
	return rewriteAgainstOrigins(value, ["https://repo.packagist.org", "https://packagist.org"], "");
}

function rewriteAgainstOrigins(value: string, origins: string[], prefix: string): string {
	for (const origin of origins) {
		if (value.startsWith(origin)) {
			const rest = value.slice(origin.length);
			const path = rest.startsWith("/") ? rest : `/${rest}`;
			return `${prefix.replace(/\/$/, "")}${path}`;
		}
	}
	return value;
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
