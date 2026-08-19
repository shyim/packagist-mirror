async function importKey(secret: string): Promise<CryptoKey> {
	const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
	return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string, secret: string): Promise<string> {
	const key = await importKey(secret);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
	const packed = new Uint8Array(iv.byteLength + cipher.byteLength);
	packed.set(iv, 0);
	packed.set(new Uint8Array(cipher), iv.byteLength);
	return btoa(String.fromCharCode(...packed));
}

export async function decryptSecret(blob: string, secret: string): Promise<string> {
	const key = await importKey(secret);
	const packed = Uint8Array.from(atob(blob), (char) => char.charCodeAt(0));
	const iv = packed.slice(0, 12);
	const cipher = packed.slice(12);
	const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
	return new TextDecoder().decode(plain);
}

export function timingSafeEqual(a: string, b: string): boolean {
	const left = new TextEncoder().encode(a);
	const right = new TextEncoder().encode(b);
	if (left.byteLength !== right.byteLength) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < left.byteLength; i++) {
		diff |= left[i] ^ right[i];
	}
	return diff === 0;
}
