import { extraDistHosts } from "../db";
import { createHostAllowlist } from "../allowlist";
import { hostedP2, hostedPackagesJson } from "../hosted";

export function isHostedPath(pathname: string): boolean {
	return pathname === "/hosted" || pathname.startsWith("/hosted/");
}

export async function handleHosted(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const extra = [...parseHosts(env.ALLOWED_DIST_HOSTS), ...(await extraDistHosts(env.DB))];
	const isAllowed = createHostAllowlist(extra.join(","));

	if (url.pathname === "/hosted" || url.pathname === "/hosted/" || url.pathname === "/hosted/packages.json") {
		const body = await hostedPackagesJson(env.DB, url.origin);
		return Response.json(body, {
			headers: { "cache-control": "public, max-age=30" },
		});
	}

	const p2 = url.pathname.match(/^\/hosted\/p2\/(.+)\.json$/);
	if (p2) {
		const name = decodeURIComponent(p2[1]);
		const body = await hostedP2(env.DB, name, url.origin, isAllowed);
		if (!body) {
			return Response.json({ status: "error", message: "Package not found" }, { status: 404 });
		}
		return Response.json(body, { headers: { "cache-control": "public, max-age=60" } });
	}

	return Response.json({ status: "error", message: "Not found" }, { status: 404 });
}

function parseHosts(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean);
}
