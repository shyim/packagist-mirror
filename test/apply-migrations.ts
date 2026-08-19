import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

type EnvWithMigrations = Env & { TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1] };

await applyD1Migrations((env as EnvWithMigrations).DB, (env as EnvWithMigrations).TEST_MIGRATIONS);
