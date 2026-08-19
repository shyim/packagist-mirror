# Packagist mirror

A Composer 2 repository on Cloudflare Workers. Mirror Packagist, extra Composer registries, GitHub/GitLab repos, and uploaded zips. Dist archives are cached in R2.

Composer 1 is not supported.

## Clients

```bash
composer config -g repos.packagist composer https://<your-host>
composer update --lock
```

| URL | What Composer sees |
|---|---|
| `https://<host>/` | Packagist.org (can be turned off in admin) |
| `https://<host>/r/<slug>/` | A Composer registry you added in the UI |
| `https://<host>/hosted` | VCS imports + uploaded packages |

Existing lock files still have GitHub/GitLab zip URLs until you run `composer update --lock`.

## Operators

Admin UI: `https://<host>/admin`

1. Create an R2 bucket and a D1 database (or keep the names in `wrangler.jsonc`).
2. Apply migrations: `npx wrangler d1 migrations apply packagist-mirror --remote`
3. `cp .dev.vars.example .dev.vars` and set `ADMIN_TOKEN` + `CONFIG_KEY` (long random strings).
4. `npx wrangler secret put ADMIN_TOKEN` and `npx wrangler secret put CONFIG_KEY` for production.
5. Optional: custom domain in `wrangler.jsonc` (`routes` + `custom_domain`).
6. `npm run deploy`

Paid Workers is required (CPU + streaming zip cache).

Optional secrets: `GITHUB_TOKEN`, `GITLAB_TOKEN` for private VCS and rate limits.

## Develop

```bash
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply packagist-mirror --local
npm test
npm run dev
```

Admin: http://127.0.0.1:8787/admin

## How zips are cached

Allowlisted `dist.url`s are rewritten onto this host. The Worker serves `dist/<sha256>` from R2, or fetches origin, streams to the client, and stores the object. Uploaded packages live at `/dist/upload/<vendor>/<package>/<version>.zip`.
