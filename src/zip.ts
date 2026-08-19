const MAX_BYTES = 32 * 1024 * 1024;

export async function extractComposerJson(buffer: ArrayBuffer): Promise<Record<string, unknown>> {
	if (buffer.byteLength > MAX_BYTES) {
		throw new Error("Zip is larger than 32 MB");
	}
	const bytes = new Uint8Array(buffer);
	const name = "composer.json";
	const data = await readZipFile(bytes, name);
	if (!data) {
		throw new Error("Zip does not contain composer.json");
	}
	const parsed = JSON.parse(new TextDecoder().decode(data)) as unknown;
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error("composer.json is not an object");
	}
	return parsed as Record<string, unknown>;
}

async function readZipFile(bytes: Uint8Array, fileName: string): Promise<Uint8Array | null> {
	let offset = 0;
	while (offset + 30 < bytes.length) {
		if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4b) {
			break;
		}
		const sig = view32(bytes, offset);
		if (sig === 0x02014b50 || sig === 0x06054b50) {
			break;
		}
		if (sig !== 0x04034b50) {
			break;
		}
		const method = view16(bytes, offset + 8);
		const compressed = view32(bytes, offset + 18);
		const nameLen = view16(bytes, offset + 26);
		const extraLen = view16(bytes, offset + 28);
		const nameStart = offset + 30;
		const entryName = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLen));
		const dataStart = nameStart + nameLen + extraLen;
		const dataEnd = dataStart + compressed;
		if (dataEnd > bytes.length) {
			break;
		}
		const base = entryName.split("/").pop() ?? entryName;
		if (entryName === fileName || base === fileName) {
			const slice = bytes.slice(dataStart, dataEnd);
			if (method === 0) {
				return slice;
			}
			if (method === 8) {
				return inflate(slice);
			}
			throw new Error(`Unsupported zip compression method ${method}`);
		}
		offset = dataEnd;
	}
	return null;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function view16(bytes: Uint8Array, offset: number): number {
	return bytes[offset] | (bytes[offset + 1] << 8);
}

function view32(bytes: Uint8Array, offset: number): number {
	return (
		bytes[offset] |
		(bytes[offset + 1] << 8) |
		(bytes[offset + 2] << 16) |
		(bytes[offset + 3] << 24)
	) >>> 0;
}
