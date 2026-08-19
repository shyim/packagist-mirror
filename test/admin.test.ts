import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("admin auth", () => {
	it("reports setup is needed on a fresh database", async () => {
		const response = await exports.default.fetch("https://mirror.test/admin/api/setup");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ needed: true });
	});

	it("creates the first admin and rejects a second setup", async () => {
		const first = await exports.default.fetch("https://mirror.test/admin/api/setup", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "Admin",
				email: "admin@example.com",
				password: "password12",
			}),
		});
		expect(first.status).toBeLessThan(400);
		const second = await exports.default.fetch("https://mirror.test/admin/api/setup", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "Other",
				email: "other@example.com",
				password: "password12",
			}),
		});
		expect(second.status).toBe(409);
	});

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
