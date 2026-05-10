# Frontend UI stack: Tailwind CSS + shadcn/ui

Issue 02 introduces the first user-facing pages (signup, sign-in, forgot-password, reset-password). Whatever styling story lands here becomes the de-facto stack for every subsequent UI issue — the dashboard, Quick Add bottom-sheet, household switcher, recurring schedules, and so on. We chose **Tailwind CSS for styling and shadcn/ui for component primitives**.

## Why this combination

- **Tailwind** is the dominant styling choice for Next.js App Router projects. Utility-first classes scale well from one-off auth pages to a full design system, and the JIT compiler keeps the production CSS small.
- **shadcn/ui is not a dependency.** Its CLI scaffolds React+Tailwind component source (`Button`, `Input`, `Form`, `Dialog`, `Sheet`, `Toast`, etc.) directly into our repo. We own and edit the components — no version-lock pain, no peer-dep churn, no surprise breaking changes from upstream.
- **Pairs naturally with React Hook Form + Zod.** shadcn's `Form` component is designed around RHF; the same Zod schemas in `@expense/shared` validate forms client-side and DTOs server-side.
- **Component coverage matches the product roadmap.** The Quick Add bottom-sheet (issue 05), category chips (06), justification pill, switcher dropdown (09), invite dialog (10), search filters (16), and CSV-export buttons (17) all map cleanly to shadcn primitives.

## Why not the alternatives

- **Plain CSS modules.** Zero deps, but the moment we introduce dialogs, popovers, and toasts (Quick Add alone needs all three), we either reinvent each one or switch stacks anyway — redoing the auth pages.
- **Tailwind without shadcn.** Lighter footprint, but in practice we'd hand-roll a `<Button>` primitive, then write a slightly different `<Button>` in the next feature. shadcn pre-empts that drift with a coherent baseline we still own.
- **MUI / Mantine / Chakra.** Heavier runtime, opinionated theming systems, harder to escape. Less aligned with where the React ecosystem is moving in 2025–2026.
- **CSS-in-JS (vanilla-extract, panda).** Adds build-time complexity for dubious benefit at MVP scale; the React team's own guidance has cooled on runtime CSS-in-JS.

## What this issue installs

Bootstrap dependencies in `apps/web`: `tailwindcss`, `postcss`, `autoprefixer`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `react-hook-form`, `@hookform/resolvers`. Run `npx shadcn@latest init` with the App Router defaults and CSS-variables theming. Generate only the primitives this issue needs — `button`, `input`, `label`, `card`, `form` — and add others lazily as later issues require them.

## Consequences

- **Migrating away is meaningful work.** Every page written hereafter assumes Tailwind classes are available. Switching to a different system would require a whole-app restyle.
- **shadcn updates are pull-not-push.** Bug fixes in upstream components don't reach us automatically. Periodically re-run the CLI for changed components and review the diff.
- **Theme tokens live in `app/globals.css` as CSS variables.** Any future design-system work (custom colors, spacing scale) plugs in through Tailwind's `theme.extend` and the CSS-var layer; no separate theming framework needed.
- **Dark mode is on the table for free.** shadcn defaults to `class`-based dark mode; we don't need to ship it now, but adding a toggle later is a small UI change rather than a stack migration.
- **Bundle size is bounded.** Tailwind purges unused utilities; shadcn components are tree-shaken. The auth pages add < 30 KB gzipped to the JS bundle.
