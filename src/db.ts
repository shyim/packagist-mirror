export type RemoteRow = {
	slug: string;
	url: string;
	auth_type: "none" | "bearer" | "basic";
	auth_blob: string | null;
	dist_hosts: string;
	enabled: number;
	last_error: string | null;
};

export type PackageRow = {
	name: string;
	source: "vcs" | "upload";
	vcs_url: string | null;
	token_blob: string | null;
	last_sync_at: number | null;
	last_error: string | null;
};

export type VersionRow = {
	name: string;
	version: string;
	version_normalized: string;
	dist_key: string | null;
	dist_kind: "upload" | "proxy";
	origin_url: string | null;
	reference: string | null;
	shasum: string | null;
	package_json: string;
};

export async function getSetting(db: D1Database, key: string, fallback = ""): Promise<string> {
	const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
	return row?.value ?? fallback;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
	await db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
}

export async function listRemotes(db: D1Database): Promise<RemoteRow[]> {
	const result = await db.prepare("SELECT * FROM remotes ORDER BY slug").all<RemoteRow>();
	return result.results ?? [];
}

export async function getRemote(db: D1Database, slug: string): Promise<RemoteRow | null> {
	return db.prepare("SELECT * FROM remotes WHERE slug = ?").bind(slug).first<RemoteRow>();
}

export async function extraDistHosts(db: D1Database): Promise<string[]> {
	const remotes = await listRemotes(db);
	const hosts: string[] = [];
	for (const remote of remotes) {
		if (!remote.enabled) {
			continue;
		}
		try {
			hosts.push(...(JSON.parse(remote.dist_hosts) as string[]));
		} catch {
			// ignore bad JSON
		}
	}
	return hosts;
}

export async function listPackages(db: D1Database): Promise<Array<PackageRow & { versions: number }>> {
	const result = await db
		.prepare(
			`SELECT p.*, (SELECT COUNT(*) FROM versions v WHERE v.name = p.name) AS versions
			 FROM packages p ORDER BY p.name`,
		)
		.all<PackageRow & { versions: number }>();
	return result.results ?? [];
}

export async function getPackage(db: D1Database, name: string): Promise<PackageRow | null> {
	return db.prepare("SELECT * FROM packages WHERE name = ?").bind(name).first<PackageRow>();
}

export async function listVersions(db: D1Database, name: string): Promise<VersionRow[]> {
	const result = await db
		.prepare("SELECT * FROM versions WHERE name = ? ORDER BY version_normalized DESC")
		.bind(name)
		.all<VersionRow>();
	return result.results ?? [];
}

export async function listPackageNames(db: D1Database): Promise<string[]> {
	const result = await db.prepare("SELECT name FROM packages ORDER BY name").all<{ name: string }>();
	return (result.results ?? []).map((row) => row.name);
}
