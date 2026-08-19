/** Minimal Composer-like normalizer for tagged releases (v1.2.3 → 1.2.3.0). */
export function normalizeVersion(raw: string): string {
	let value = raw.trim();
	if (value.startsWith("v") || value.startsWith("V")) {
		value = value.slice(1);
	}
	const [core, suffix] = splitStability(value);
	const parts = core.split(".").filter(Boolean);
	while (parts.length < 4) {
		parts.push("0");
	}
	const numeric = parts
		.slice(0, 4)
		.map((part) => (part.match(/^\d+/)?.[0] ?? "0"))
		.join(".");
	return suffix ? `${numeric}-${suffix}` : numeric;
}

function splitStability(value: string): [string, string] {
	const match = value.match(/^(.+?)[-_](dev|alpha|a|beta|b|RC|rc)[.]?(\d*)$/i);
	if (!match) {
		return [value, ""];
	}
	const label = match[2].toLowerCase().replace("rc", "RC").replace(/^a$/, "alpha").replace(/^b$/, "beta");
	return [match[1], match[3] ? `${label}${match[3]}` : label];
}

export function versionFromTag(tag: string): string {
	return tag.startsWith("v") || tag.startsWith("V") ? tag.slice(1) : tag;
}
