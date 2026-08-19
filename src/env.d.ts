interface Env {
	BUCKET: R2Bucket;
	DB: D1Database;
	ASSETS: Fetcher;
	UPSTREAM_REPO: string;
	UPSTREAM_API: string;
	CONTACT_EMAIL: string;
	ALLOWED_DIST_HOSTS: string;
	ADMIN_TOKEN?: string;
	CONFIG_KEY?: string;
	GITHUB_TOKEN?: string;
	GITLAB_TOKEN?: string;
}

declare module "cloudflare:workers" {
	interface ProvidedEnv extends Env {}
}
