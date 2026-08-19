import { decryptSecret } from "../crypto";
import { extraDistHosts, getRemote } from "../db";
import { createHostAllowlist } from "../allowlist";
import { originHeaders } from "../origin";
import { rewriteP2Metadata, type P2Metadata } from "../rewrite/metadata";
import { rewritePackagesJson, rewriteRemoteAbsoluteUrls } from "../rewrite/packages-json";
import { cachedJson } from "./upstream";

export function isRemotePath(pathname: string): boolean {
	return pathname.startsWith("/r/");
}

export async function handleRemote(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);
	const match = url.pathname.match(/^\/r\/([a-z0-9-]+)(\/.*)?$/);
	if (!match) {
		return new Response("Not found", { status: 404 });
	}
	const slug = match[1];
	const rest = match[2] && match[2] !== "" ? match[2] : "/packages.json";
	const remote = await getRemote(env.DB, slug);
	if (!remote || !remote.enabled) {
		return new Response(JSON.stringify({ status: "error", message: "Unknown remote" }), {
			status: 404,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}

	const prefix = `/r/${slug}`;
	const upstreamPath = rest === "/" ? "/packages.json" : rest;
	const upstreamUrl = `${remote.url}${upstreamPath}${url.search}`;
	const extraAuth = await remoteAuth(env, remote.auth_type, remote.auth_blob);
	const extraHosts = [...parseHosts(env.ALLOWED_DIST_HOSTS), ...JSON.parse(remote.dist_hosts || "[]"), ...(await extraDistHosts(env.DB))];
	const isAllowed = createHostAllowlist(extraHosts.join(","));

	return cachedJson(request, ctx, rest.includes("/p2/") ? "public, max-age=300" : "public, max-age=60", async () => {
		const incoming = new URL(request.url);
		const headers = originHeaders(incoming, env, new URL(upstreamUrl), request.headers.get("accept") ?? undefined, extraAuth);
		if (request.headers.get("if-modified-since")) {
			headers.set("if-modified-since", request.headers.get("if-modified-since")!);
		}
		const origin = await fetch(upstreamUrl, { method: request.method === "HEAD" ? "HEAD" : "GET", headers });
		if (origin.status === 404) {
			await env.DB.prepare("UPDATE remotes SET last_error = ? WHERE slug = ?").bind(`404 ${upstreamPath}`, slug).run();
			return new Response(JSON.stringify({ status: "error", message: "Not found" }), {
				status: 404,
				headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" },
			});
		}
		if (!origin.ok) {
			await env.DB.prepare("UPDATE remotes SET last_error = ? WHERE slug = ?").bind(`${origin.status} ${upstreamPath}`, slug).run();
			return origin;
		}
		if (request.method === "HEAD") {
			return origin;
		}
		const data = (await origin.json()) as Record<string, unknown>;
		const origins = originBases(remote.url);
		let body: unknown = rewriteRemoteAbsoluteUrls(data, origins, prefix);
		if (upstreamPath === "/packages.json" || upstreamPath.endsWith("/packages.json")) {
			body = rewritePackagesJson(body as Record<string, unknown>, prefix);
		} else if (upstreamPath.includes("/p2/") || upstreamPath.endsWith(".json")) {
			body = rewriteP2Metadata(body as P2Metadata, isAllowed, url.origin);
		}
		await env.DB.prepare("UPDATE remotes SET last_error = NULL WHERE slug = ?").bind(slug).run();
		return { body, origin };
	});
}

async function remoteAuth(env: Env, type: string, blob: string | null): Promise<string | undefined> {
	if (!blob || type === "none" || !env.CONFIG_KEY) {
		return undefined;
	}
	const secret = await decryptSecret(blob, env.CONFIG_KEY);
	if (type === "basic") {
		return `Basic ${btoa(secret)}`;
	}
	return `Bearer ${secret}`;
}

function originBases(repoUrl: string): string[] {
	try {
		const url = new URL(repoUrl);
		return [url.origin, repoUrl];
	} catch {
		return [repoUrl];
	}
}

function parseHosts(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean);
}
