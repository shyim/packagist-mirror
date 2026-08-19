import { createHostAllowlist } from "../allowlist";
import { rewriteP2Metadata, type P2Metadata } from "../rewrite/metadata";
import { cachedJson, fetchUpstreamJson } from "./upstream";

const HIT_CACHE_CONTROL = "public, max-age=300";
const MISS_CACHE_CONTROL = "public, max-age=60";
const PACKAGE_FILE = /^\/p2\/([a-z0-9]([_.-]?[a-z0-9]+)*)\/([a-z0-9](([_.]|-{1,2})?[a-z0-9]+)*(~dev)?)\.json$/i;

export function isP2Path(pathname: string): boolean {
	return pathname.startsWith("/p2/") && pathname.endsWith(".json");
}

export function isValidP2Path(pathname: string): boolean {
	return PACKAGE_FILE.test(pathname);
}

export async function handleP2Metadata(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);
	if (!isValidP2Path(url.pathname)) {
		return jsonNotFound(MISS_CACHE_CONTROL);
	}

	const isAllowed = createHostAllowlist(env.ALLOWED_DIST_HOSTS);
	const publicOrigin = url.origin;
	return cachedJson(request, ctx, HIT_CACHE_CONTROL, async () => {
		const { data, origin } = await fetchUpstreamJson(
			request,
			env,
			`${env.UPSTREAM_REPO}${url.pathname}`,
		);
		if (origin.status === 404) {
			return jsonNotFound(MISS_CACHE_CONTROL);
		}
		if (!data) {
			return origin;
		}
		return { body: rewriteP2Metadata(data as P2Metadata, isAllowed, publicOrigin), origin };
	});
}

function jsonNotFound(cacheControl: string): Response {
	return new Response(JSON.stringify({ status: "error", message: "Package not found" }), {
		status: 404,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": cacheControl,
		},
	});
}
