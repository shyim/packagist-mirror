# Packagist mirror

A Composer 2 repository on Cloudflare Workers. Point Composer at the Worker instead of packagist.org. Package metadata is proxied from Packagist; zipballs are rewritten onto this host and cached on the fly in R2.

Composer 1 is not supported. Packagist shut that protocol down in September 2025.

## Use it

Point Composer at the Worker for metadata, and install the plugin so zip downloads go through R2 **without rewriting `composer.lock`**:

```bash
composer config -g repos.packagist composer https://packages.shyim.de
composer global config allow-plugins.shyim/packagist-mirror-plugin true
composer global require shyim/packagist-mirror-plugin
```

The plugin hooks `PRE_FILE_DOWNLOAD` and fetches allowlisted zip URLs from `https://packages.shyim.de/dist/https/<host>/<path>`. Lock files keep the original GitHub/GitLab `dist.url`.

Per-project instead of global:

```bash
composer config allow-plugins.shyim/packagist-mirror-plugin true
composer require --dev shyim/packagist-mirror-plugin
```

Override the mirror URL with `PACKAGIST_MIRROR` or `extra.packagist-mirror.url`.

Metadata still rewrites `dist.url` only if the Worker var `REWRITE_DIST_URLS` is `1` (off by default, because that *does* change lock files).

## What it serves

| Path | Role |
|---|---|
| `/packages.json` | Composer repository root, with URLs rewritten onto this Worker |
| `/p2/<vendor>/<package>.json` | Composer 2 metadata (origin `dist.url` left intact) |
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

1. Composer resolves packages from `/packages.json` and `/p2/...` (lock file still stores GitHub/GitLab URLs).
2. The Composer plugin rewrites the download to `/dist/https/<host>/<path>` at fetch time.
3. The Worker looks up `dist/<sha256(originUrl)>` in R2.
4. On a miss it fetches the origin zip, streams it to Composer, and `tee()`s the same stream into R2.

R2 puts are atomic. If the client aborts mid-download, the next request fetches again.
