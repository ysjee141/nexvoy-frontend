# Repository Guidelines

## Project Structure & Module Organization

This is the `nexvoy-frontend` pnpm workspace for OnVoy. Web code lives in `apps/web` and uses Next.js App Router, Panda CSS, Supabase helpers, Zustand stores, and Playwright tests in `apps/web/e2e`. Mobile code lives in `apps/mobile` and uses Expo Router, React Native, local-first services, and the native crypto module in `apps/mobile/modules/onvoy-native-crypto`. Shared TypeScript packages live in `packages`: `core` for platform-independent business logic, sync, local-first, repositories, and tests; `types` for shared domain/database types; `design-tokens` for platform-neutral tokens. Supabase migrations/functions are in `supabase`; architecture and task docs are in `docs`.

## Build, Test, and Development Commands

- `pnpm dev` or `pnpm dev:web`: run the Next.js web app.
- `pnpm dev:mobile`: start Expo for the mobile app.
- `pnpm build`: run Panda codegen and build the web app.
- `pnpm build:packages`: type-build shared workspace packages.
- `pnpm typecheck`: type-check shared packages and mobile.
- `pnpm --filter @nexvoy/core test`: run core unit tests with `tsx`.
- `pnpm test:e2e`: run web Playwright tests.
- `pnpm lint:mobile`: run Expo ESLint for mobile.

## Coding Style & Naming Conventions

Use TypeScript throughout. Follow existing file patterns: React components in PascalCase (`TripClient.tsx`), hooks as `useThing.ts`, services/repositories as descriptive camelCase or PascalCase matching neighbors, and tests as `*.test.ts` in `__tests__`. Prefer `packages/core` for logic shared by web and mobile. Web styling should use Panda CSS tokens/config where possible. Before editing Next.js code, read `apps/web/AGENTS.md`; this repo uses a newer Next.js with changed conventions.

## Testing Guidelines

Place unit tests next to shared logic under `packages/core/src/**/__tests__`. Add focused tests for local-first, sync, repository, and permission changes. Use Playwright specs in `apps/web/e2e` for browser workflows. Run the smallest relevant test first, then broaden to `pnpm typecheck`, `pnpm build`, or E2E when touching shared contracts or user flows.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits and task-scoped messages, for example `feat(TASK-025): add P2P checklist status UI`, `fix(TASK-025): stabilize web p2p handshake`, and `docs: define full local-first product scope`. Keep commits focused. PRs should describe behavior changes, link the task or issue, list verification commands, and include screenshots for UI changes. Note Supabase migrations, env vars, or mobile native changes explicitly.

## Security & Configuration Tips

Do not commit `.env.local`, build outputs, APKs, or secrets. Treat Supabase RLS, signaling topics, document keys, and local-first sync code as security-sensitive; include migration and permission testing notes when changing them.
