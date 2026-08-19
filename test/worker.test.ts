import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("worker routes", () => {
	it("serves a status page", async () => {
		const response = await exports.default.fetch("https://mirror.test/");
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("composer config -g repos.packagist composer");
	});

	it("rewrites packages.json onto this host", async () => {
		mockFetch({
			"https://repo.packagist.org/packages.json": {
				packages: [],
				"metadata-url": "https://repo.packagist.org/p2/%package%.json",
				"notify-batch": "https://packagist.org/downloads/",
				warning: "upgrade composer 2",
			},
		});

		const response = await exports.default.fetch("https://mirror.test/packages.json");
		expect(response.status).toBe(200);
		const body = (await response.json()) as { "metadata-url": string; "notify-batch": string };
		expect(body["metadata-url"]).toBe("/p2/%package%.json");
		expect(body["notify-batch"]).toBe("/downloads/");
	});

	it("rewrites p2 dist URLs and keeps source URLs", async () => {
		mockFetch({
			"https://repo.packagist.org/p2/monolog/monolog.json": {
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
								reference: "abc123",
							},
						},
					],
				},
			},
		});

		const response = await exports.default.fetch("https://mirror.test/p2/monolog/monolog.json");
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			minified: string;
			packages: {
				"monolog/monolog": Array<{
					source: { url: string };
					dist: { url: string };
				}>;
			};
		};
		expect(body.minified).toBe("composer/2.0");
		expect(body.packages["monolog/monolog"][0].source.url).toBe(
			"https://github.com/Seldaek/monolog.git",
		);
		expect(body.packages["monolog/monolog"][0].dist.url).toBe(
			"https://mirror.test/dist/https/api.github.com/repos/Seldaek/monolog/zipball/abc123",
		);
	});

	it("returns a fast 404 for unknown packages", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const request = new Request(input);
			if (request.url === "https://repo.packagist.org/p2/missing/package.json") {
				return new Response("not found", { status: 404 });
			}
			throw new Error(`Unexpected request: ${request.url}`);
		});

		const response = await exports.default.fetch("https://mirror.test/p2/missing/package.json");
		expect(response.status).toBe(404);
	});

	it("rejects dist hosts that are not allowlisted", async () => {
		const response = await exports.default.fetch(
			"https://mirror.test/dist/https/evil.example/payload.zip",
		);
		expect(response.status).toBe(403);
	});

	it("caches a zip in R2 on the first miss", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const request = new Request(input);
			if (request.url === "https://codeload.github.com/Seldaek/monolog/legacy.zip/abc123") {
				return new Response("PK\u0003\u0004zip", {
					headers: { "content-type": "application/zip" },
				});
			}
			throw new Error(`Unexpected request: ${request.url}`);
		});

		const ctx = createExecutionContext();
		const first = await worker.fetch(
			new Request(
				"https://mirror.test/dist/https/api.github.com/repos/Seldaek/monolog/zipball/abc123",
			),
			env,
			ctx,
		);
		const zip = "PK\u0003\u0004zip";
		expect(first.status).toBe(200);
		expect(await first.arrayBuffer()).toEqual(new TextEncoder().encode(zip).buffer);
		await waitOnExecutionContext(ctx);

		const second = await worker.fetch(
			new Request(
				"https://mirror.test/dist/https/api.github.com/repos/Seldaek/monolog/zipball/abc123",
			),
			env,
			createExecutionContext(),
		);
		expect(second.status).toBe(200);
		expect(await second.arrayBuffer()).toEqual(new TextEncoder().encode(zip).buffer);
		expect(await env.BUCKET.head(await r2Key("https://api.github.com/repos/Seldaek/monolog/zipball/abc123"))).not.toBeNull();
	});
});

function mockFetch(replies: Record<string, unknown>): void {
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
		const request = new Request(input);
		if (request.url in replies) {
			return Response.json(replies[request.url]);
		}
		throw new Error(`Unexpected request: ${request.url}`);
	});
}

async function r2Key(origin: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(origin));
	const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	return `dist/${hex}`;
}

declare module "cloudflare:workers" {
	interface ProvidedEnv extends Env {}
}
