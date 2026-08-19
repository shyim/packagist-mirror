import { timingSafeEqual } from "./crypto";

const COOKIE = "pm_admin";

export function isAdminAuthorized(request: Request, env: Env): boolean {
	const expected = env.ADMIN_TOKEN?.trim();
	if (!expected) {
		return false;
	}

	const header = request.headers.get("authorization");
	if (header?.toLowerCase().startsWith("bearer ")) {
		return timingSafeEqual(header.slice(7).trim(), expected);
	}

	const cookie = request.headers.get("cookie") ?? "";
	const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
	if (match) {
		return timingSafeEqual(decodeURIComponent(match[1]), expected);
	}

	return false;
}

export function adminCookie(request: Request, token: string, maxAge: number): string {
	const url = new URL(request.url);
	const secure = url.protocol === "https:" ? "; Secure" : "";
	return `${COOKIE}=${encodeURIComponent(token)}; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

export function unauthorized(): Response {
	return json({ status: "error", message: "Unauthorized" }, 401);
}
