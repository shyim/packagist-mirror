import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("admin auth", () => {
	it("rejects unauthenticated admin API", async () => {
		const response = await exports.default.fetch("https://mirror.test/admin/api/remotes");
		expect(response.status).toBe(401);
	});

	it("serves hosted packages.json with available-packages", async () => {
		const response = await exports.default.fetch("https://mirror.test/hosted/packages.json");
		expect(response.status).toBe(200);
		const body = (await response.json()) as { "available-packages": string[]; "metadata-url": string };
		expect(body["metadata-url"]).toBe("/hosted/p2/%package%.json");
		expect(Array.isArray(body["available-packages"])).toBe(true);
	});
});

describe("version helper", () => {
	it("normalizes tagged versions", async () => {
		const { normalizeVersion } = await import("../src/version");
		expect(normalizeVersion("v1.2.3")).toBe("1.2.3.0");
		expect(normalizeVersion("3.9.0")).toBe("3.9.0.0");
	});
});
