interface Env {
	GITHUB_TOKEN?: string;
}

declare module "cloudflare:workers" {
	interface ProvidedEnv extends Env {}
}
