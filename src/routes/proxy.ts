import { proxyJson, proxyRaw } from "./upstream";

export async function handleDownloads(request: Request, env: Env): Promise<Response> {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
	}
	return proxyRaw(request, env, `${env.UPSTREAM_API}/downloads/`);
}

export async function handleSearch(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const incoming = new URL(request.url);
	return proxyJson(
		request,
		env,
		ctx,
		`${env.UPSTREAM_API}/search.json${incoming.search}`,
		"public, max-age=30",
	);
}

export async function handleList(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const incoming = new URL(request.url);
	return proxyJson(
		request,
		env,
		ctx,
		`${env.UPSTREAM_API}/packages/list.json${incoming.search}`,
		"public, max-age=300",
	);
}

export async function handleProviders(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const incoming = new URL(request.url);
	return proxyJson(
		request,
		env,
		ctx,
		`${env.UPSTREAM_API}${incoming.pathname}`,
		"public, max-age=300",
	);
}

export async function handleSecurityAdvisories(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const incoming = new URL(request.url);
	if (request.method === "POST") {
		return proxyRaw(request, env, `${env.UPSTREAM_API}/api/security-advisories/${incoming.search}`);
	}
	return proxyJson(
		request,
		env,
		ctx,
		`${env.UPSTREAM_API}/api/security-advisories/${incoming.search}`,
		"public, max-age=60",
	);
}

export async function handleMetadataChanges(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const incoming = new URL(request.url);
	return proxyJson(
		request,
		env,
		ctx,
		`${env.UPSTREAM_API}/metadata/changes.json${incoming.search}`,
		"public, max-age=15",
	);
}

export async function handleFilterSummary(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	return proxyJson(
		request,
		env,
		ctx,
		`${env.UPSTREAM_REPO}/lists/all/summary.json`,
		"public, max-age=300",
	);
}
