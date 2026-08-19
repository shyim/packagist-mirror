import { getSetting } from "../db";
import { rewritePackagesJson } from "../rewrite/packages-json";
import { cachedJson, fetchUpstreamJson } from "./upstream";

const CACHE_CONTROL = "public, max-age=60";

export async function handlePackagesJson(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const enabled = (await getSetting(env.DB, "packagist_enabled", "1")) !== "0";
	if (!enabled) {
		return new Response(JSON.stringify({ status: "error", message: "Packagist mirroring is disabled" }), {
			status: 404,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}

	return cachedJson(request, ctx, CACHE_CONTROL, async () => {
		const { data, origin } = await fetchUpstreamJson(request, env, `${env.UPSTREAM_REPO}/packages.json`);
		if (!data) {
			return origin;
		}
		return { body: rewritePackagesJson(data), origin };
	});
}
