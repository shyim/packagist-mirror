import { rewritePackagesJson } from "../rewrite/packages-json";
import { cachedJson, fetchUpstreamJson } from "./upstream";

const CACHE_CONTROL = "public, max-age=60";

export async function handlePackagesJson(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	return cachedJson(request, ctx, CACHE_CONTROL, async () => {
		const { data, origin } = await fetchUpstreamJson(request, env, `${env.UPSTREAM_REPO}/packages.json`);
		if (!data) {
			return origin;
		}
		return { body: rewritePackagesJson(data), origin };
	});
}
