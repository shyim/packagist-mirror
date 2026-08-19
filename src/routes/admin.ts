import { adminCookie, isAdminAuthorized, json, unauthorized } from "../auth";
import { encryptSecret } from "../crypto";
import { extraDistHosts, getPackage, getSetting, listPackages, listRemotes, listVersions, setSetting } from "../db";
import { parseVcsUrl, importVcsPackage } from "../vcs";
import { extractComposerJson } from "../zip";

export async function handleAdmin(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;

	if (path === "/admin" || path === "/admin/") {
		return env.ASSETS.fetch(new Request(new URL("/index.html", url.origin), request));
	}
	if (path.startsWith("/admin/") && !path.startsWith("/admin/api/")) {
		return env.ASSETS.fetch(new Request(new URL(path.slice("/admin".length), url.origin), request));
	}

	if (path === "/admin/api/login" && request.method === "POST") {
		const body = (await request.json()) as { token?: string };
		const token = body.token?.trim() ?? "";
		if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
			return unauthorized();
		}
		return new Response(JSON.stringify({ ok: true }), {
			headers: {
				"content-type": "application/json; charset=utf-8",
				"set-cookie": adminCookie(request, token, 2592000),
			},
		});
	}

	if (!isAdminAuthorized(request, env)) {
		if (path === "/admin/api/session") {
			return json({ authenticated: false });
		}
		return unauthorized();
	}

	if (path === "/admin/api/logout" && request.method === "POST") {
		return new Response(JSON.stringify({ ok: true }), {
			headers: {
				"content-type": "application/json; charset=utf-8",
				"set-cookie": adminCookie(request, "", 0),
			},
		});
	}

	if (path === "/admin/api/session") {
		return json({ authenticated: true });
	}

	if (path === "/admin/api/settings" && request.method === "GET") {
		return json({
			packagist_enabled: (await getSetting(env.DB, "packagist_enabled", "1")) !== "0",
			contact_email: (await getSetting(env.DB, "contact_email", env.CONTACT_EMAIL)) || env.CONTACT_EMAIL,
			allowed_dist_hosts: [...parseHosts(env.ALLOWED_DIST_HOSTS), ...(await extraDistHosts(env.DB))],
		});
	}

	if (path === "/admin/api/settings" && request.method === "PUT") {
		const body = (await request.json()) as { packagist_enabled?: boolean; contact_email?: string };
		if (typeof body.packagist_enabled === "boolean") {
			await setSetting(env.DB, "packagist_enabled", body.packagist_enabled ? "1" : "0");
		}
		if (typeof body.contact_email === "string") {
			await setSetting(env.DB, "contact_email", body.contact_email);
		}
		return json({ ok: true });
	}

	if (path === "/admin/api/remotes" && request.method === "GET") {
		const remotes = await listRemotes(env.DB);
		return json({
			remotes: remotes.map((remote) => ({
				slug: remote.slug,
				url: remote.url,
				auth_type: remote.auth_type,
				dist_hosts: JSON.parse(remote.dist_hosts || "[]"),
				enabled: Boolean(remote.enabled),
				last_error: remote.last_error,
				has_token: Boolean(remote.auth_blob),
			})),
		});
	}

	if (path === "/admin/api/remotes" && request.method === "POST") {
		const body = (await request.json()) as {
			slug?: string;
			url?: string;
			auth_type?: "none" | "bearer" | "basic";
			token?: string;
			username?: string;
			password?: string;
			dist_hosts?: string[];
		};
		const slug = (body.slug ?? "").trim().toLowerCase();
		if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
			return json({ status: "error", message: "Slug must be lowercase alphanumeric" }, 400);
		}
		const repoUrl = normalizeRepoUrl(body.url ?? "");
		if (!repoUrl) {
			return json({ status: "error", message: "A Composer repository URL is required" }, 400);
		}
		try {
			await assertComposerRepo(repoUrl, request, env);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Could not fetch packages.json";
			return json({ status: "error", message }, 400);
		}

		let authBlob: string | null = null;
		const authType = body.auth_type ?? "none";
		if (authType !== "none") {
			if (!env.CONFIG_KEY) {
				return json({ status: "error", message: "CONFIG_KEY secret is required to store tokens" }, 400);
			}
			const secret = authType === "basic" ? `${body.username ?? ""}:${body.password ?? ""}` : (body.token ?? "");
			if (!secret || secret === ":") {
				return json({ status: "error", message: "Auth credentials required" }, 400);
			}
			authBlob = await encryptSecret(secret, env.CONFIG_KEY);
		}

		await env.DB.prepare(
			`INSERT INTO remotes (slug, url, auth_type, auth_blob, dist_hosts, enabled, last_error)
			 VALUES (?, ?, ?, ?, ?, 1, NULL)
			 ON CONFLICT(slug) DO UPDATE SET url = excluded.url, auth_type = excluded.auth_type,
			   auth_blob = COALESCE(excluded.auth_blob, remotes.auth_blob), dist_hosts = excluded.dist_hosts, last_error = NULL`,
		)
			.bind(slug, repoUrl, authType, authBlob, JSON.stringify(body.dist_hosts ?? []))
			.run();
		return json({ ok: true, slug });
	}

	const remoteMatch = path.match(/^\/admin\/api\/remotes\/([a-z0-9-]+)$/);
	if (remoteMatch && request.method === "DELETE") {
		await env.DB.prepare("DELETE FROM remotes WHERE slug = ?").bind(remoteMatch[1]).run();
		return json({ ok: true });
	}

	if (path === "/admin/api/packages" && request.method === "GET") {
		const packages = await listPackages(env.DB);
		return json({ packages });
	}

	if (path === "/admin/api/packages/vcs" && request.method === "POST") {
		const body = (await request.json()) as { url?: string; token?: string };
		const target = parseVcsUrl(body.url ?? "");
		if (!target) {
			return json({ status: "error", message: "Use a GitHub or GitLab HTTPS URL" }, 400);
		}
		const placeholder = `${target.owner.toLowerCase()}/${target.repo.toLowerCase()}`;
		let tokenBlob: string | null = null;
		if (body.token?.trim()) {
			if (!env.CONFIG_KEY) {
				return json({ status: "error", message: "CONFIG_KEY secret is required to store tokens" }, 400);
			}
			tokenBlob = await encryptSecret(body.token.trim(), env.CONFIG_KEY);
		}
		await env.DB.prepare(
			`INSERT INTO packages (name, source, vcs_url, token_blob, last_sync_at, last_error)
			 VALUES (?, 'vcs', ?, ?, NULL, NULL)
			 ON CONFLICT(name) DO UPDATE SET vcs_url = excluded.vcs_url, token_blob = COALESCE(excluded.token_blob, packages.token_blob)`,
		)
			.bind(placeholder, body.url, tokenBlob)
			.run();

		const pkg = await getPackage(env.DB, placeholder);
		if (pkg) {
			ctx.waitUntil(runImport(env, pkg, url));
		}
		return json({ ok: true, name: placeholder });
	}

	if (path === "/admin/api/packages/upload" && request.method === "POST") {
		return handleUpload(request, env);
	}

	const syncMatch = path.match(/^\/admin\/api\/packages\/sync$/);
	if (syncMatch && request.method === "POST") {
		const name = url.searchParams.get("name");
		if (!name) {
			return json({ status: "error", message: "name is required" }, 400);
		}
		const pkg = await getPackage(env.DB, name);
		if (!pkg || pkg.source !== "vcs") {
			return json({ status: "error", message: "Unknown VCS package" }, 404);
		}
		ctx.waitUntil(runImport(env, pkg, url));
		return json({ ok: true });
	}

	if (path === "/admin/api/packages" && request.method === "DELETE") {
		const name = url.searchParams.get("name");
		if (!name) {
			return json({ status: "error", message: "name is required" }, 400);
		}
		const versions = await listVersions(env.DB, name);
		for (const version of versions) {
			if (version.dist_key) {
				await env.BUCKET.delete(version.dist_key);
			}
		}
		await env.DB.prepare("DELETE FROM versions WHERE name = ?").bind(name).run();
		await env.DB.prepare("DELETE FROM packages WHERE name = ?").bind(name).run();
		return json({ ok: true });
	}

	if (path === "/admin/api/versions" && request.method === "GET") {
		const name = url.searchParams.get("name");
		if (!name) {
			return json({ status: "error", message: "name is required" }, 400);
		}
		return json({ versions: await listVersions(env.DB, name) });
	}

	if (path === "/admin/api/versions" && request.method === "DELETE") {
		const name = url.searchParams.get("name");
		const version = url.searchParams.get("version");
		if (!name || !version) {
			return json({ status: "error", message: "name and version are required" }, 400);
		}
		const row = await env.DB.prepare("SELECT dist_key FROM versions WHERE name = ? AND version = ?")
			.bind(name, version)
			.first<{ dist_key: string | null }>();
		if (row?.dist_key) {
			await env.BUCKET.delete(row.dist_key);
		}
		await env.DB.prepare("DELETE FROM versions WHERE name = ? AND version = ?").bind(name, version).run();
		return json({ ok: true });
	}

	return json({ status: "error", message: "Not found" }, 404);
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
	const form = await request.formData();
	const file = form.get("file");
	if (!(file instanceof File)) {
		return json({ status: "error", message: "file is required" }, 400);
	}
	const buffer = await file.arrayBuffer();
	let composer: Record<string, unknown>;
	try {
		composer = await extractComposerJson(buffer);
	} catch (error) {
		return json({ status: "error", message: error instanceof Error ? error.message : "Invalid zip" }, 400);
	}
	const name = String(form.get("name") || composer.name || "");
	const version = String(form.get("version") || composer.version || "");
	if (!name.includes("/") || !version) {
		return json({ status: "error", message: "composer.json must include name and version" }, 400);
	}

	const key = `upload/${name}/${version}.zip`;
	const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");

	await env.BUCKET.put(key, buffer, { httpMetadata: { contentType: "application/zip" } });
	await env.DB.prepare(
		`INSERT INTO packages (name, source, vcs_url, token_blob, last_sync_at, last_error)
		 VALUES (?, 'upload', NULL, NULL, ?, NULL)
		 ON CONFLICT(name) DO UPDATE SET last_sync_at = excluded.last_sync_at`,
	)
		.bind(name, Date.now())
		.run();
	await env.DB.prepare(
		`INSERT INTO versions (name, version, version_normalized, dist_key, dist_kind, origin_url, reference, shasum, package_json)
		 VALUES (?, ?, ?, ?, 'upload', NULL, ?, ?, ?)
		 ON CONFLICT(name, version) DO UPDATE SET dist_key = excluded.dist_key, shasum = excluded.shasum, package_json = excluded.package_json`,
	)
		.bind(name, version, version, key, version, hash, JSON.stringify(composer))
		.run();

	return json({ ok: true, name, version, shasum: hash });
}

async function runImport(env: Env, pkg: Awaited<ReturnType<typeof getPackage>>, requestUrl: URL): Promise<void> {
	if (!pkg) {
		return;
	}
	try {
		await importVcsPackage(env, pkg, requestUrl);
	} catch (error) {
		const message = error instanceof Error ? error.message : "import failed";
		await env.DB.prepare("UPDATE packages SET last_error = ? WHERE name = ?").bind(message, pkg.name).run();
	}
}

function normalizeRepoUrl(raw: string): string | null {
	try {
		const url = new URL(raw);
		if (url.protocol !== "https:") {
			return null;
		}
		url.pathname = url.pathname.replace(/\/packages\.json$/, "") || "/";
		if (url.pathname !== "/") {
			url.pathname = url.pathname.replace(/\/$/, "");
		}
		return url.toString().replace(/\/$/, "");
	} catch {
		return null;
	}
}

async function assertComposerRepo(repoUrl: string, request: Request, env: Env): Promise<void> {
	const probe = `${repoUrl}/packages.json`;
	const incoming = new URL(request.url);
	const headers = new Headers({ "user-agent": `packagist-mirror/1.0 (+https://${incoming.host})` });
	const response = await fetch(probe, { headers });
	if (!response.ok) {
		throw new Error(`Upstream returned ${response.status} for packages.json`);
	}
	const data = (await response.json()) as Record<string, unknown>;
	if (!data || typeof data !== "object") {
		throw new Error("Upstream packages.json is not an object");
	}
}

function parseHosts(raw: string | undefined): string[] {
	return (raw ?? "")
		.split(",")
		.map((host) => host.trim())
		.filter(Boolean);
}
