# Task 1: Add JWT verification middleware and types

**Branch:** `feat/1-jwt-middleware`
**PR:** #42 (merged at 2026-04-30T15:30:00Z)
**AUTO spec:** `docs/specs/2026-04-30-jwt-middleware-design.md`
**AUTO plan:** `docs/plans/2026-04-30-jwt-middleware.md`

## Built

- Added `verifyJwt` middleware in `src/auth/middleware.ts`
- Wired middleware into the request pipeline in `src/server.ts:42`
- Defined `JwtPayload` type in `src/auth/types.ts`
- Added unit tests in `tests/auth/middleware.test.ts`

## Decided

- Used HS256 instead of RS256 because we don't yet have a key-rotation pipeline. Re-evaluate after rollout.
- Token TTL set to 15min; refresh-token flow deferred to task 3.
- Middleware mutates `req.user`; downstream handlers MUST treat it as set.

## Touched

- `src/auth/middleware.ts` (new)
- `src/auth/types.ts` (new)
- `src/server.ts` (modified)
- `tests/auth/middleware.test.ts` (new)
- `package.json` (added `jsonwebtoken` dep)

## Gotchas

- HS256 secret is read from `process.env.JWT_SECRET`; tests need that env var or they will skip.
- The middleware does NOT validate token expiry separately — it relies on `jsonwebtoken`'s built-in check. If you mock the lib in tests, mock `verify` not the helper.
