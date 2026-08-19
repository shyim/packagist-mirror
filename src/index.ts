import { getPackage, listPackages } from "./db";
import { handleAdmin } from "./routes/admin";
import { handleDist, isDistPath } from "./routes/dist";
import { handleHosted, isHostedPath } from "./routes/hosted";
import { handleP2Metadata, isP2Path } from "./routes/metadata";
import { handlePackagesJson } from "./routes/packages-json";
import {
	handleDownloads,
	handleFilterSummary,
	handleList,
	handleMetadataChanges,
	handleProviders,
	handleSearch,
	handleSecurityAdvisories,
} from "./routes/proxy";
import { handleRemote, isRemotePath } from "./routes/remote";
import { handleStatus } from "./routes/status";
import { importVcsPackage } from "./vcs";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		try {
			if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
				return await handleAdmin(request, env, ctx);
			}
			if (url.pathname === "/" || url.pathname === "/healthz") {
				return handleStatus(request);
			}
			if (url.pathname === "/packages.json") {
				return await handlePackagesJson(request, env, ctx);
			}
			if (isRemotePath(url.pathname)) {
				return await handleRemote(request, env, ctx);
			}
			if (isHostedPath(url.pathname)) {
				return await handleHosted(request, env);
			}
			if (isP2Path(url.pathname)) {
				return await handleP2Metadata(request, env, ctx);
			}
			if (isDistPath(url.pathname)) {
				return await handleDist(request, env, ctx);
			}
			if (url.pathname === "/downloads/") {
				return await handleDownloads(request, env);
			}
			if (url.pathname === "/search.json") {
				return await handleSearch(request, env, ctx);
			}
			if (url.pathname === "/packages/list.json") {
				return await handleList(request, env, ctx);
			}
			if (url.pathname.startsWith("/providers/") && url.pathname.endsWith(".json")) {
				return await handleProviders(request, env, ctx);
			}
			if (url.pathname === "/api/security-advisories" || url.pathname === "/api/security-advisories/") {
				return await handleSecurityAdvisories(request, env, ctx);
			}
			if (url.pathname === "/metadata/changes.json") {
				return await handleMetadataChanges(request, env, ctx);
			}
			if (url.pathname === "/lists/all/summary.json") {
				return await handleFilterSummary(request, env, ctx);
			}

			return new Response(JSON.stringify({ status: "error", message: "Not found" }), {
				status: 404,
				headers: { "content-type": "application/json; charset=utf-8" },
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Internal error";
			console.error(JSON.stringify({ level: "error", path: url.pathname, message }));
			return new Response(JSON.stringify({ status: "error", message: "Internal error" }), {
				status: 500,
				headers: { "content-type": "application/json; charset=utf-8" },
			});
		}
	},

	async scheduled(_event, env): Promise<void> {
		const packages = await listPackages(env.DB);
		const requestUrl = new URL("https://localhost/");
		for (const pkg of packages) {
			if (pkg.source !== "vcs") {
				continue;
			}
			const row = await getPackage(env.DB, pkg.name);
			if (!row) {
				continue;
			}
			try {
				await importVcsPackage(env, row, requestUrl);
			} catch (error) {
				const message = error instanceof Error ? error.message : "sync failed";
				await env.DB.prepare("UPDATE packages SET last_error = ? WHERE name = ?").bind(message, pkg.name).run();
			}
		}
	},
} satisfies ExportedHandler<Env>;
