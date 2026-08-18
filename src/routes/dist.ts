import { createHostAllowlist } from "../allowlist";
import { normalizeOriginUrl, originHeaders } from "../origin";
import { parseDistRequest } from "../rewrite/dist-url";
import { sha256Hex } from "../util/hash";

export function isDistPath(pathname: string): boolean {
	return pathname.startsWith("/dist/");
}

export async function handleDist(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
	}

	const url = new URL(request.url);
	const originUrl = parseDistRequest(url.pathname, url.search);
	if (!originUrl) {
		return new Response("Invalid dist URL", { status: 400 });
	}

	const isAllowed = createHostAllowlist(env.ALLOWED_DIST_HOSTS);
	if (!isAllowed(originUrl.hostname)) {
		return new Response("Dist host is not allowlisted", { status: 403 });
	}

	const key = `dist/${await sha256Hex(originUrl.href)}`;
	const cached = await env.BUCKET.get(key, {
		...(request.headers.has("range") ? { range: request.headers } : {}),
		onlyIf: request.headers,
	});
	if (cached) {
		return r2Response(cached, request.method, request.headers.has("range"));
	}

	const fetchUrl = normalizeOriginUrl(originUrl);
	const upstream = await fetch(fetchUrl, {
		headers: originHeaders(url, env, fetchUrl),
		redirect: "follow",
	});
	if (!upstream.ok || !upstream.body) {
		return new Response(upstream.body, {
			status: upstream.status,
			statusText: upstream.statusText,
			headers: {
				"content-type": upstream.headers.get("content-type") ?? "text/plain",
				"cache-control": "no-store",
			},
		});
	}

	const contentType = upstream.headers.get("content-type") ?? "application/zip";
	const headers = {
		"content-type": contentType,
		"cache-control": "public, max-age=31536000, immutable",
	};

	if (request.method === "HEAD") {
		ctx.waitUntil(
			env.BUCKET.put(key, upstream.body, {
				httpMetadata: { contentType },
				customMetadata: { origin: originUrl.href },
			}),
		);
		return new Response(null, { status: 200, headers });
	}

	const [toClient, toR2] = upstream.body.tee();
	ctx.waitUntil(
		env.BUCKET.put(key, toR2, {
			httpMetadata: { contentType },
			customMetadata: { origin: originUrl.href },
		}),
	);
	return new Response(toClient, { status: 200, headers });
}

function r2Response(object: R2Object | R2ObjectBody, method: string, ranged: boolean): Response {
	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("etag", object.httpEtag);
	headers.set("cache-control", "public, max-age=31536000, immutable");
	if (
		ranged &&
		object.range &&
		"offset" in object.range &&
		typeof object.range.offset === "number"
	) {
		const length =
			"length" in object.range && typeof object.range.length === "number"
				? object.range.length
				: object.size - object.range.offset;
		headers.set(
			"content-range",
			`bytes ${object.range.offset}-${object.range.offset + length - 1}/${object.size}`,
		);
	}

	const hasBody = "body" in object;
	return new Response(method === "HEAD" || !hasBody ? null : object.body, {
		status: hasBody ? (ranged ? 206 : 200) : 412,
		headers,
	});
}
