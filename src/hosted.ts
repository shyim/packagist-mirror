import { listPackageNames, listVersions } from "./db";
import { toDistPath } from "./rewrite/dist-url";

export async function hostedPackagesJson(db: D1Database, publicOrigin: string): Promise<Record<string, unknown>> {
	const names = await listPackageNames(db);
	return {
		packages: [],
		"metadata-url": "/hosted/p2/%package%.json",
		"available-packages": names,
		"notify-batch": "/downloads/",
	};
}

export async function hostedP2(
	db: D1Database,
	name: string,
	publicOrigin: string,
	isAllowed: (host: string) => boolean,
): Promise<Record<string, unknown> | null> {
	const versions = await listVersions(db, name);
	if (versions.length === 0) {
		return null;
	}

	const packages = [];
	for (const row of versions) {
		const pkg = JSON.parse(row.package_json) as Record<string, unknown>;
		pkg.name = name;
		pkg.version = row.version;
		pkg.version_normalized = row.version_normalized;
		if (row.dist_kind === "upload" && row.dist_key) {
			pkg.dist = {
				type: "zip",
				url: `${publicOrigin}/dist/upload/${name}/${encodeURIComponent(row.version)}.zip`,
				reference: row.reference ?? row.version,
				shasum: row.shasum ?? "",
			};
		} else if (row.origin_url) {
			const rewritten = toDistPath(row.origin_url, isAllowed, publicOrigin);
			pkg.dist = {
				type: "zip",
				url: rewritten ?? row.origin_url,
				reference: row.reference ?? "",
				shasum: row.shasum ?? "",
			};
		}
		packages.push(pkg);
	}

	return { packages: { [name]: packages } };
}
