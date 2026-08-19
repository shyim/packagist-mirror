# Packagist mirror

A Composer 2 repository on Cloudflare Workers. Point Composer at the Worker instead of packagist.org. Package metadata is proxied from Packagist; zipballs are rewritten onto this host and cached on the fly in R2.

Composer 1 is not supported. Packagist shut that protocol down in September 2025.

## Use it

```bash
composer config -g repos.packagist composer https://packages.shyim.de
```

Existing `composer.lock` files still contain GitHub/GitLab zip URLs. Rewrite those locations without bumping versions:

```bash
composer update --lock
```

New resolves (`composer update`, new projects) get mirrored dist URLs automatically.

## What it serves

| Path | Role |
|---|---|
| `/packages.json` | Composer repository root, with URLs rewritten onto this Worker |
| `/p2/<vendor>/<package>.json` | Composer 2 metadata, `dist.url` rewritten to this Worker |
| `/dist/https/<host>/<path>` | Zip cache (R2 hit, or fetch origin + stream + store) |
| `/downloads/` | Forwards Composer install notifications to Packagist |
| `/search.json`, `/packages/list.json`, `/providers/*`, `/api/security-advisories/`, `/metadata/changes.json`, `/lists/all/summary.json` | Proxied Packagist APIs |

Zips are only fetched for allowlisted hosts (`api.github.com`, `codeload.github.com`, `github.com`, `gitlab.com`, `bitbucket.org`, `*.githubusercontent.com`). Unknown `/dist` hosts return 403. Unknown metadata `dist.url` hosts are left pointing at origin so custom CDNs still work.

GitHub `api.github.com/.../zipball/<ref>` URLs are fetched from `codeload.github.com` so public archives do not burn the GitHub API rate limit.

## Develop

```bash
npm install
cp .dev.vars.example .dev.vars
npm test
npm run dev
```

Then, in another project:

```bash
composer config repos.packagist composer http://127.0.0.1:8787
composer update --lock
```

## Deploy

Production is `https://packages.shyim.de` (`packagist-mirror` Worker + R2 bucket, custom domain on `shyim.de`).

```bash
npm run deploy
```

Optional, for GitHub release assets that 404 without auth:

```bash
npx wrangler secret put GITHUB_TOKEN
```

## How zip caching works

1. Composer asks for `/p2/vendor/package.json`.
2. The Worker rewrites each allowlisted `dist.url` to `https://packages.shyim.de/dist/https/<host>/<path>`.
3. Composer writes that URL into `composer.lock` and downloads it.
4. The Worker looks up `dist/<sha256(originUrl)>` in R2.
5. On a miss it fetches the origin zip, streams it to Composer, and `tee()`s the same stream into R2.

R2 puts are atomic. If the client aborts mid-download, the next request fetches again.
