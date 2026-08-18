type JsonObject = Record<string, unknown>;

export function rewritePackagesJson(upstream: JsonObject): JsonObject {
	const rewritten: JsonObject = { ...upstream };

	rewritten["notify-batch"] = "/downloads/";
	rewritten["metadata-url"] = "/p2/%package%.json";
	rewritten["metadata-changes-url"] = "/metadata/changes.json";
	rewritten.search = "/search.json?q=%query%&type=%type%";
	rewritten.list = "/packages/list.json";
	rewritten["providers-api"] = "/providers/%package%.json";

	const security = upstream["security-advisories"];
	if (isObject(security)) {
		rewritten["security-advisories"] = {
			...security,
			"api-url": "/api/security-advisories/",
		};
	}

	const filter = upstream.filter;
	if (isObject(filter)) {
		rewritten.filter = {
			...filter,
			"summary-url": "/lists/all/summary.json",
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

function rewritePackagistUrl(value: string): string {
	for (const origin of ["https://repo.packagist.org", "https://packagist.org"]) {
		if (value.startsWith(origin)) {
			const rest = value.slice(origin.length);
			return rest.startsWith("/") ? rest : `/${rest}`;
		}
	}
	return value;
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
