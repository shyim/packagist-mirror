import { decryptSecret } from "./crypto";
import type { PackageRow } from "./db";
import { originHeaders } from "./origin";
import { normalizeVersion, versionFromTag } from "./version";

const TAG_CAP = 100;

type VcsTarget = {
	host: "github" | "gitlab";
	apiRoot: string;
	owner: string;
	repo: string;
	zipball: (ref: string) => string;
};

export function parseVcsUrl(raw: string): VcsTarget | null {
	let url: URL;
	try {
		url = new URL(raw.replace(/\.git$/, ""));
	} catch {
		return null;
	}
	const parts = url.pathname.replace(/^\//, "").split("/").filter(Boolean);
	if (parts.length < 2) {
		return null;
	}
	const owner = parts[0];
	const repo = parts[1].replace(/\.git$/, "");

	if (url.hostname === "github.com" || url.hostname === "www.github.com") {
		return {
			host: "github",
			apiRoot: "https://api.github.com",
			owner,
			repo,
			zipball: (ref) => `https://api.github.com/repos/${owner}/${repo}/zipball/${ref}`,
		};
	}

	const gitlabHost = url.hostname === "gitlab.com" || url.hostname.includes("gitlab");
	if (gitlabHost) {
		const project = encodeURIComponent(`${owner}/${repo}`);
		return {
			host: "gitlab",
			apiRoot: `${url.origin}/api/v4`,
			owner,
			repo,
			zipball: (ref) => `${url.origin}/api/v4/projects/${project}/repository/archive.zip?sha=${encodeURIComponent(ref)}`,
		};
	}

	return null;
}

export async function importVcsPackage(
	env: Env,
	pkg: PackageRow,
	requestUrl: URL,
): Promise<{ name: string; versions: number }> {
	const target = pkg.vcs_url ? parseVcsUrl(pkg.vcs_url) : null;
	if (!target) {
		throw new Error("Unsupported VCS URL (GitHub and GitLab only)");
	}

	const token = await packageToken(env, pkg);
	const extraAuth = token ? `Bearer ${token}` : undefined;
	const tags = await listTags(target, requestUrl, env, extraAuth);
	let name = pkg.name;
	let stored = 0;

	for (const tag of tags) {
		const composer = await fetchComposerJson(target, tag, requestUrl, env, extraAuth);
		if (!composer) {
			continue;
		}
		const pkgName = typeof composer.name === "string" ? composer.name : name;
		if (!pkgName.includes("/")) {
			continue;
		}
		name = pkgName;
		const version = typeof composer.version === "string" ? composer.version : versionFromTag(tag);
		const normalized = normalizeVersion(version);
		const origin = target.zipball(tag);
		await env.DB.prepare(
			`INSERT INTO versions (name, version, version_normalized, dist_key, dist_kind, origin_url, reference, shasum, package_json)
			 VALUES (?, ?, ?, NULL, 'proxy', ?, ?, '', ?)
			 ON CONFLICT(name, version) DO UPDATE SET
			   version_normalized = excluded.version_normalized,
			   origin_url = excluded.origin_url,
			   reference = excluded.reference,
			   package_json = excluded.package_json`,
		)
			.bind(pkgName, version, normalized, origin, tag, JSON.stringify(composer))
			.run();
		stored += 1;
	}

	if (name !== pkg.name) {
		await env.DB.prepare("UPDATE packages SET name = ? WHERE name = ?").bind(name, pkg.name).run();
		await env.DB.prepare("UPDATE versions SET name = ? WHERE name = ?").bind(name, pkg.name).run();
	}

	await env.DB.prepare("UPDATE packages SET last_sync_at = ?, last_error = NULL WHERE name = ?")
		.bind(Date.now(), name)
		.run();

	return { name, versions: stored };
}

async function packageToken(env: Env, pkg: PackageRow): Promise<string | undefined> {
	if (pkg.token_blob && env.CONFIG_KEY) {
		return decryptSecret(pkg.token_blob, env.CONFIG_KEY);
	}
	const target = pkg.vcs_url ? parseVcsUrl(pkg.vcs_url) : null;
	if (target?.host === "github") {
		return env.GITHUB_TOKEN?.trim() || undefined;
	}
	if (target?.host === "gitlab") {
		return env.GITLAB_TOKEN?.trim() || undefined;
	}
	return undefined;
}

async function listTags(
	target: VcsTarget,
	requestUrl: URL,
	env: Env,
	extraAuth?: string,
): Promise<string[]> {
	if (target.host === "github") {
		const url = `${target.apiRoot}/repos/${target.owner}/${target.repo}/tags?per_page=${TAG_CAP}`;
		const response = await fetch(url, { headers: originHeaders(requestUrl, env, new URL(url), "application/json", extraAuth) });
		if (!response.ok) {
			throw new Error(`GitHub tags failed: ${response.status}`);
		}
		const tags = (await response.json()) as Array<{ name?: string }>;
		return tags.map((tag) => tag.name).filter((name): name is string => Boolean(name)).slice(0, TAG_CAP);
	}

	const url = `${target.apiRoot}/projects/${encodeURIComponent(`${target.owner}/${target.repo}`)}/repository/tags?per_page=${TAG_CAP}`;
	const response = await fetch(url, { headers: originHeaders(requestUrl, env, new URL(url), "application/json", extraAuth) });
	if (!response.ok) {
		throw new Error(`GitLab tags failed: ${response.status}`);
	}
	const tags = (await response.json()) as Array<{ name?: string }>;
	return tags.map((tag) => tag.name).filter((name): name is string => Boolean(name)).slice(0, TAG_CAP);
}

async function fetchComposerJson(
	target: VcsTarget,
	ref: string,
	requestUrl: URL,
	env: Env,
	extraAuth?: string,
): Promise<Record<string, unknown> | null> {
	if (target.host === "github") {
		const url = `${target.apiRoot}/repos/${target.owner}/${target.repo}/contents/composer.json?ref=${encodeURIComponent(ref)}`;
		const response = await fetch(url, { headers: originHeaders(requestUrl, env, new URL(url), "application/vnd.github.raw+json", extraAuth) });
		if (!response.ok) {
			return null;
		}
		return parseComposerBody(await response.text());
	}

	const url = `${target.apiRoot}/projects/${encodeURIComponent(`${target.owner}/${target.repo}`)}/repository/files/composer.json/raw?ref=${encodeURIComponent(ref)}`;
	const response = await fetch(url, { headers: originHeaders(requestUrl, env, new URL(url), undefined, extraAuth) });
	if (!response.ok) {
		return null;
	}
	return parseComposerBody(await response.text());
}

function parseComposerBody(text: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(text) as Record<string, unknown>;
		if (typeof parsed.content === "string" && parsed.encoding === "base64") {
			return JSON.parse(atob(parsed.content.replace(/\s/g, ""))) as Record<string, unknown>;
		}
		return parsed;
	} catch {
		return null;
	}
}
