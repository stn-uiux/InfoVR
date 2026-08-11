# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript app for 3D server-room and equipment modeling. Main code lives in `src/`.

- `src/components/`: React UI components, including modals, rack rendering, previews, and scene controls.
- `src/store/`: Zustand application state and actions.
- `src/hooks/`: reusable React hooks, including SVG composition logic.
- `src/utils/`: asset loading, storage, geometry, comparison, and port helpers.
- `src/types/`: shared TypeScript interfaces and domain types.
- `src/assets/`: SVG, PNG, card, and 3D assets.
- `src/port-sentinel/`: separate port mapping/editor experience.
- `public/`: static public assets.
- `dist/`: build output; do not edit manually.

## Build, Test, and Development Commands

- `npm run dev`: start the Vite development server.
- `npm run build`: run TypeScript checks and produce production assets in `dist/`.
- `npm run lint`: run ESLint across the repository.
- `npm run preview`: serve the built `dist/` output locally.

There is currently no `npm test` script. Use `npm run build` and `npm run lint` as the baseline verification before handing off changes.

## Coding Style & Naming Conventions

Use TypeScript and React functional components. Prefer explicit domain types from `src/types/` over `any`. Keep component filenames in PascalCase, hooks as `useSomething.ts`, and utilities in camelCase files. Put SCSS beside related components or in `src/styles/`.

Follow the existing style: two-space indentation in TS/TSX, double quotes in most edited files, and concise comments only where useful. Reuse helpers from `src/utils/` before adding abstractions.

## Testing Guidelines

No automated test framework is configured in `package.json`. For behavior changes, validate with TypeScript checks, ESLint, and manual testing in the Vite dev server. When adding tests later, colocate them near the feature or under a clear test directory.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit-style prefixes such as `feat:`, `fix:`, and `refactor:`. Keep commits scoped to one logical change, for example: `fix: apply custom model row gaps in equipment assembly`.

Pull requests should include a summary, verification steps (`npm run build`, `npm run lint`, manual checks), linked issues if applicable, and screenshots for UI changes.

## Security & Configuration Tips

Keep local secrets in `.env.local`; do not commit environment-specific credentials. Commit generated `dist/` changes only when explicitly required for release or deployment.
