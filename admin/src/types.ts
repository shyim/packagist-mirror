export type Remote = {
	slug: string;
	url: string;
	auth_type: string;
	last_error: string | null;
};

export type Pkg = {
	name: string;
	source: string;
	versions: number;
	last_error: string | null;
};

export type UserRow = {
	id: string;
	name: string;
	email: string;
	role: string | null;
};
