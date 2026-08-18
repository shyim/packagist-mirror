import { originHeaders } from "../origin";
import { rewritePackagistAbsoluteUrls } from "../rewrite/packages-json";

type JsonObject = Record<string, unknown>;

export async function fetchUpstream(
	request: Request,
	env: Env,
	upstreamUrl: string,
	init: RequestInit = {},
): Promise<Response> {
	const incoming = new URL(request.url);
	const target = new URL(upstreamUrl);
	const method = init.method ?? (request.method === "HEAD" ? "HEAD" : "GET");
	const headers = originHeaders(incoming, env, target, request.headers.get("accept") ?? undefined);

	if (method === "GET" || method === "HEAD") {
		const ifModifiedSince = request.headers.get("if-modified-since");
		if (ifModifiedSince) {
			headers.set("if-modified-since", ifModifiedSince);
		}
		const ifNoneMatch = request.headers.get("if-none-match");
		if (ifNoneMatch) {
			headers.set("if-none-match", ifNoneMatch);
		}
	}

	const contentType = request.headers.get("content-type");
	if (contentType && init.body) {
		headers.set("content-type", contentType);
	}

	return fetch(target, {
		method,
		headers,
		body: init.body,
		redirect: "follow",
	});
}

export async function fetchUpstreamJson(
	request: Request,
	env: Env,
	upstreamUrl: string,
): Promise<{ data: JsonObject | null; origin: Response }> {
	const origin = await fetchUpstream(request, env, upstreamUrl);
	if (origin.status === 304 || origin.status === 404 || request.method === "HEAD") {
		return { data: null, origin };
	}
	if (!origin.ok) {
		return { data: null, origin };
	}

	const data = (await origin.json()) as unknown;
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return { data: null, origin: jsonError("Upstream returned invalid JSON", 502) };
	}
	return { data: data as JsonObject, origin };
}

export async function cachedJson(
	request: Request,
	ctx: ExecutionContext,
	cacheControl: string,
	load: () => Promise<{ body: unknown; origin: Response } | Response>,
): Promise<Response> {
	const cache = caches.default;
	const cacheKey = new Request(request.url, { method: "GET" });
	const cached = await cache.match(request);
	if (cached) {
		return cached;
	}

	const result = await load();
	if (result instanceof Response) {
		if (isCacheable(result)) {
			ctx.waitUntil(cache.put(cacheKey, result.clone()));
		}
		return result;
	}

	const headers = new Headers({
		"content-type": "application/json; charset=utf-8",
		"cache-control": cacheControl,
	});
	copyHeader(result.origin, headers, "last-modified");
	copyHeader(result.origin, headers, "etag");

	const response = new Response(JSON.stringify(result.body), {
		status: 200,
		headers,
	});
	ctx.waitUntil(cache.put(cacheKey, response.clone()));
	return response;
}

export async function proxyJson(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	upstreamUrl: string,
	cacheControl: string,
): Promise<Response> {
	return cachedJson(request, ctx, cacheControl, async () => {
		const { data, origin } = await fetchUpstreamJson(request, env, upstreamUrl);
		if (!data) {
			return passthrough(origin, cacheControl);
		}
		return { body: rewritePackagistAbsoluteUrls(data), origin };
	});
}

export async function proxyRaw(
	request: Request,
	env: Env,
	upstreamUrl: string,
): Promise<Response> {
	const origin = await fetchUpstream(request, env, upstreamUrl, {
		method: request.method,
		body: request.body,
	});
	const headers = new Headers(origin.headers);
	headers.delete("content-encoding");
	headers.delete("content-length");
	headers.delete("transfer-encoding");
	return new Response(origin.body, {
		status: origin.status,
		statusText: origin.statusText,
		headers,
	});
}

function passthrough(origin: Response, cacheControl: string): Response {
	const headers = new Headers(origin.headers);
	headers.delete("content-encoding");
	headers.delete("content-length");
	headers.delete("transfer-encoding");
	if (origin.status === 404 || origin.status === 304) {
		headers.set("cache-control", cacheControl);
	}
	return new Response(origin.body, {
		status: origin.status,
		statusText: origin.statusText,
		headers,
	});
}

function copyHeader(from: Response, to: Headers, name: string): void {
	const value = from.headers.get(name);
	if (value) {
		to.set(name, value);
	}
}

function isCacheable(response: Response): boolean {
	return response.status === 200 || response.status === 404;
}

function jsonError(message: string, status: number): Response {
	return new Response(JSON.stringify({ status: "error", message }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}
