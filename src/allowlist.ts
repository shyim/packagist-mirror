const DEFAULT_EXACT_HOSTS = new Set([
	"api.github.com",
	"codeload.github.com",
	"github.com",
	"gitlab.com",
	"bitbucket.org",
]);

const DEFAULT_SUFFIXES = [".githubusercontent.com"];

export function parseAllowedHosts(extra: string | undefined): string[] {
	if (!extra) {
		return [];
	}
	return extra
		.split(",")
		.map((host) => host.trim().toLowerCase())
		.filter((host) => host.length > 0);
}

export function isAllowedDistHost(host: string, extraHosts: readonly string[] = []): boolean {
	const normalized = host.toLowerCase();
	if (DEFAULT_EXACT_HOSTS.has(normalized)) {
		return true;
	}
	if (extraHosts.includes(normalized)) {
		return true;
	}
	return DEFAULT_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function createHostAllowlist(extraHostsRaw: string | undefined): (host: string) => boolean {
	const extra = parseAllowedHosts(extraHostsRaw);
	return (host: string) => isAllowedDistHost(host, extra);
}
