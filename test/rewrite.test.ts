import { describe, expect, it } from "vitest";
import { isAllowedDistHost } from "../src/allowlist";
import { normalizeOriginUrl } from "../src/origin";
import { parseDistRequest, toDistPath } from "../src/rewrite/dist-url";
import { rewriteP2Metadata } from "../src/rewrite/metadata";
import { rewritePackagesJson, rewritePackagistAbsoluteUrls } from "../src/rewrite/packages-json";
import { isValidP2Path } from "../src/routes/metadata";

describe("packages.json rewrite", () => {
	it("rewrites advertised URLs to root-relative paths and keeps warnings", () => {
		const rewritten = rewritePackagesJson({
			packages: [],
			"notify-batch": "https://packagist.org/downloads/",
			"metadata-url": "https://repo.packagist.org/p2/%package%.json",
			"metadata-changes-url": "https://packagist.org/metadata/changes.json",
			search: "https://packagist.org/search.json?q=%query%&type=%type%",
			list: "https://packagist.org/packages/list.json",
			"security-advisories": {
				metadata: true,
				"api-url": "https://packagist.org/api/security-advisories/",
			},
			"providers-api": "https://packagist.org/providers/%package%.json",
			warning: "upgrade",
			"warning-versions": "<1.999",
			filter: {
				metadata: true,
				lists: { malware: { enabled: true } },
				"summary-url": "https://repo.packagist.org/lists/all/summary.json",
			},
		});

		expect(rewritten["metadata-url"]).toBe("/p2/%package%.json");
		expect(rewritten["notify-batch"]).toBe("/downloads/");
		expect(rewritten.search).toBe("/search.json?q=%query%&type=%type%");
		expect(rewritten.list).toBe("/packages/list.json");
		expect(rewritten["providers-api"]).toBe("/providers/%package%.json");
		expect(rewritten["metadata-changes-url"]).toBe("/metadata/changes.json");
		expect(rewritten.warning).toBe("upgrade");
		expect(rewritten["warning-versions"]).toBe("<1.999");
		expect(rewritten["security-advisories"]).toEqual({
			metadata: true,
			"api-url": "/api/security-advisories/",
		});
		expect(rewritten.filter).toEqual({
			metadata: true,
			lists: { malware: { enabled: true } },
			"summary-url": "/lists/all/summary.json",
		});
	});
});

describe("p2 metadata rewrite", () => {
	it("rewrites allowlisted dist URLs and leaves source URLs alone", () => {
		const rewritten = rewriteP2Metadata(
			{
				minified: "composer/2.0",
				packages: {
					"monolog/monolog": [
						{
							name: "monolog/monolog",
							version: "3.10.0",
							source: {
								url: "https://github.com/Seldaek/monolog.git",
								type: "git",
								reference: "abc123",
							},
							dist: {
								url: "https://api.github.com/repos/Seldaek/monolog/zipball/abc123",
								type: "zip",
								shasum: "",
								reference: "abc123",
							},
						},
						{
							version: "3.9.0",
							dist: {
								url: "https://api.github.com/repos/Seldaek/monolog/zipball/def456",
								type: "zip",
								reference: "def456",
							},
						},
					],
				},
			},
			(host) => isAllowedDistHost(host),
			"https://mirror.example",
		);

		expect(rewritten.minified).toBe("composer/2.0");
		expect(rewritten.packages?.["monolog/monolog"][0].source?.url).toBe(
			"https://github.com/Seldaek/monolog.git",
		);
		expect(rewritten.packages?.["monolog/monolog"][0].dist?.url).toBe(
			"https://mirror.example/dist/https/api.github.com/repos/Seldaek/monolog/zipball/abc123",
		);
		expect(rewritten.packages?.["monolog/monolog"][1].dist?.url).toBe(
			"https://mirror.example/dist/https/api.github.com/repos/Seldaek/monolog/zipball/def456",
		);
	});

	it("does not rewrite dist URLs on unknown hosts", () => {
		const original = "https://downloads.example.com/acme.zip";
		const rewritten = rewriteP2Metadata(
			{
				packages: {
					"acme/lib": [{ dist: { url: original, type: "zip" } }],
				},
			},
			(host) => isAllowedDistHost(host),
			"https://mirror.example",
		);
		expect(rewritten.packages?.["acme/lib"][0].dist?.url).toBe(original);
	});
});

describe("dist URL codec", () => {
	it("round-trips an origin URL", () => {
		const origin = "https://api.github.com/repos/Seldaek/monolog/zipball/abc123";
		const path = toDistPath(origin, () => true, "https://mirror.example");
		expect(path).toBe(
			"https://mirror.example/dist/https/api.github.com/repos/Seldaek/monolog/zipball/abc123",
		);
		expect(parseDistRequest(new URL(path!).pathname, "")?.href).toBe(origin);
	});

	it("preserves query strings used by GitLab archives", () => {
		const origin = "https://gitlab.com/api/v4/projects/1/repository/archive.zip?sha=deadbeef";
		const path = toDistPath(origin, () => true, "https://mirror.example");
		expect(path).toBe(
			"https://mirror.example/dist/https/gitlab.com/api/v4/projects/1/repository/archive.zip?sha=deadbeef",
		);
		const parsed = parseDistRequest(new URL(path!).pathname, "?sha=deadbeef");
		expect(parsed?.href).toBe(origin);
	});
});

describe("allowlist", () => {
	it("allows GitHub family hosts and extra configured hosts", () => {
		expect(isAllowedDistHost("api.github.com")).toBe(true);
		expect(isAllowedDistHost("codeload.github.com")).toBe(true);
		expect(isAllowedDistHost("objects.githubusercontent.com")).toBe(true);
		expect(isAllowedDistHost("evil.example")).toBe(false);
		expect(isAllowedDistHost("downloads.drupal.org", ["downloads.drupal.org"])).toBe(true);
	});
});

describe("GitHub zipball normalize", () => {
	it("rewrites api.github.com zipballs to codeload", () => {
		const normalized = normalizeOriginUrl(
			new URL("https://api.github.com/repos/Seldaek/monolog/zipball/abc123"),
		);
		expect(normalized.href).toBe("https://codeload.github.com/Seldaek/monolog/legacy.zip/abc123");
	});
});

describe("p2 path validation", () => {
	it("accepts stable and ~dev metadata files", () => {
		expect(isValidP2Path("/p2/monolog/monolog.json")).toBe(true);
		expect(isValidP2Path("/p2/monolog/monolog~dev.json")).toBe(true);
		expect(isValidP2Path("/p2/league/flysystem-aws-s3-v3.json")).toBe(true);
		expect(isValidP2Path("/p2/not-a-package.json")).toBe(false);
		expect(isValidP2Path("/p2/../packages.json")).toBe(false);
	});
});

describe("absolute packagist URL rewrite", () => {
	it("rewrites pagination links and leaves unrelated strings", () => {
		const rewritten = rewritePackagistAbsoluteUrls({
			next: "https://packagist.org/search.json?q=monolog&page=2",
			description: "See https://example.com",
		});
		expect(rewritten).toEqual({
			next: "/search.json?q=monolog&page=2",
			description: "See https://example.com",
		});
	});
});
