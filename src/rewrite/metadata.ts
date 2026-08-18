import { toDistPath } from "./dist-url";

type Dist = {
	url?: string;
	type?: string;
	shasum?: string;
	reference?: string;
};

type PackageVersion = {
	dist?: Dist;
	source?: { url?: string; type?: string; reference?: string };
	[key: string]: unknown;
};

export type P2Metadata = {
	minified?: string;
	packages?: Record<string, PackageVersion[]>;
	filter?: unknown;
	[key: string]: unknown;
};

export function rewriteP2Metadata(
	data: P2Metadata,
	isAllowed: (host: string) => boolean,
	publicOrigin: string,
): P2Metadata {
	if (!data.packages) {
		return data;
	}

	for (const versions of Object.values(data.packages)) {
		if (!Array.isArray(versions)) {
			continue;
		}
		for (const version of versions) {
			const url = version.dist?.url;
			if (typeof url !== "string") {
				continue;
			}
			const rewritten = toDistPath(url, isAllowed, publicOrigin);
			if (rewritten) {
				version.dist = { ...version.dist, url: rewritten };
			}
		}
	}

	return data;
}
