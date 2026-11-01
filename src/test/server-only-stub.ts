// `server-only` throws when imported outside the Next.js build; the
// integration tests import repo modules directly, so it is aliased to
// this empty module in vitest.integration.config.ts only.
export {};
