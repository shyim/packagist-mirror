export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(path, {
		credentials: "include",
		...options,
		headers: {
			...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
			...options.headers,
		},
	});
	const data = (await response.json().catch(() => ({}))) as T & { message?: string };
	if (!response.ok) {
		throw new Error(data.message || response.statusText);
	}
	return data;
}
