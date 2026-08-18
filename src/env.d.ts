interface Env {
	GITHUB_TOKEN?: string;
	REWRITE_DIST_URLS?: string;
}

declare module "cloudflare:workers" {
	interface ProvidedEnv extends Env {}
}
