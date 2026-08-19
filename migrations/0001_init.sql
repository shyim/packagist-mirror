CREATE TABLE remotes (
	slug TEXT PRIMARY KEY,
	url TEXT NOT NULL,
	auth_type TEXT NOT NULL DEFAULT 'none',
	auth_blob TEXT,
	dist_hosts TEXT NOT NULL DEFAULT '[]',
	enabled INTEGER NOT NULL DEFAULT 1,
	last_error TEXT
);

CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

CREATE TABLE packages (
	name TEXT PRIMARY KEY,
	source TEXT NOT NULL,
	vcs_url TEXT,
	token_blob TEXT,
	last_sync_at INTEGER,
	last_error TEXT
);

CREATE TABLE versions (
	name TEXT NOT NULL,
	version TEXT NOT NULL,
	version_normalized TEXT NOT NULL,
	dist_key TEXT,
	dist_kind TEXT NOT NULL,
	origin_url TEXT,
	reference TEXT,
	shasum TEXT,
	package_json TEXT NOT NULL,
	PRIMARY KEY (name, version)
);

CREATE INDEX versions_name ON versions (name);

CREATE TABLE jobs (
	id TEXT PRIMARY KEY,
	kind TEXT NOT NULL,
	name TEXT,
	status TEXT NOT NULL,
	error TEXT,
	created_at INTEGER NOT NULL
);

INSERT INTO settings (key, value) VALUES ('packagist_enabled', '1');
