import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

export type AuthUser = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
};

export function createAuth(env: Env, request: Request, allowSignUp = false) {
	const origin = new URL(request.url).origin;
	const secret = env.CONFIG_KEY?.trim() || env.ADMIN_TOKEN?.trim() || "dev-only-change-me";
	return betterAuth({
		database: env.DB,
		secret,
		baseURL: origin,
		basePath: "/admin/api/auth",
		trustedOrigins: [origin],
		emailAndPassword: {
			enabled: true,
			disableSignUp: !allowSignUp,
			minPasswordLength: 8,
		},
		plugins: [
			admin({
				defaultRole: "user",
				adminRoles: ["admin"],
			}),
		],
		advanced: {
			useSecureCookies: origin.startsWith("https://"),
			disableOriginCheck: false,
		},
	});
}

export async function getAuthSession(env: Env, request: Request) {
	const auth = createAuth(env, request);
	return auth.api.getSession({ headers: request.headers });
}

export async function userCount(db: D1Database): Promise<number> {
	const row = await db.prepare('SELECT COUNT(*) AS c FROM "user"').first<{ c: number }>();
	return row?.c ?? 0;
}
