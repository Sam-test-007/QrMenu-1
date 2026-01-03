# QR Menu (Admin Dashboard)

**Overview**

- **Project:** QR Menu — admin dashboard for managing restaurants, menu items, orders, and QR generation.
- **Stack:** React + TypeScript (TSX), Vite, Supabase (DB + storage), Tailwind-style utility classes and custom UI primitives.

**Features Implemented (this branch/session)**

- **Responsive menu panel:** Collapsible Menu panel on the left for desktop and bottom sheet on mobile, with focus-trap and Escape-to-close.
- **Daily completed-orders counter:** `todayCompletedCount` recalculated per-minute and resets after midnight.
- **Optimistic order-complete updates:** UI increments completed orders optimistically when marking orders as completed.
- **QR composition & download:** Downloadable PNG combining QR code with restaurant name and table number.
- **Onboarding tour:** First-run quick tour persisted to localStorage.
- **Accessibility improvements:** ARIA attributes, aria-live announcements, titles for controls, keyboard handling.
- **Total sales:** `totalSales` displayed in the restaurant header (sum of order totals).
- **Bug fixes:** Fixed JSX parsing errors (missing closing tags) in the admin dashboard.

**Files Edited**

- [client/src/components/admin-dashboard.tsx](client/src/components/admin-dashboard.tsx) — moved menu into responsive panel; added onboarding, focus-trap, today counter, `totalSales`, and JSX fixes.
- [client/src/components/qr-code-generator.tsx](client/src/components/qr-code-generator.tsx) — compose QR + restaurant name + table on download.

**Local Setup & Run**

- Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

- Open the dev URL printed by Vite (usually `http://localhost:5173`).

**Verification Checklist**

- **Select a restaurant:** Open the Admin Dashboard and choose a restaurant.
- **Menu panel:** Click the Menu button (left on desktop / bottom sheet on mobile). Confirm focus is trapped and `Esc` closes the panel.
- **Create / complete orders:** Create or simulate orders; mark an order `completed` and verify:
  - `Today's completed` increments immediately (optimistic update).
  - `Total sales` increases by the order total.
- **QR download:** Use the QR generator to download the combined PNG and verify restaurant name/table text is present.
- **Build verification:** Ensure `npm run dev` prints no TypeScript/JSX errors.

**Troubleshooting**

- If the dev server fails with TypeScript/JSX errors: inspect the terminal for error lines and open the referenced file and line. Many recent errors were due to unbalanced JSX tags; check for missing closing tags in components.
- If QR image download looks clipped: check the `client/src/components/qr-code-generator.tsx` canvas sizing logic and adjust text wrapping/truncation.
- If images are not uploading: check Supabase storage credentials in `client/src/lib/supabase.ts` and confirm upload size limits.

**Next Steps & Recommendations**

- Run an accessibility audit with Lighthouse or axe and fix contrast and ARIA issues.
- Add tests for `totalSales` calculation and `updateOrderStatus` optimistic path.
- Implement order prioritization: visual accents, sort active orders by status/time, and collapse long item lists.
- Add CI step to run TypeScript checks and basic linting on PRs to catch JSX/TS issues early.

**Commands & Useful Notes**

- Start dev server: `npm run dev`
- Run typecheck (if configured): `npm run typecheck` (or `tsc --noEmit`)
- Install packages: `npm install`

If you want, I can now run `npm run dev` and fix any remaining errors, or run an accessibility scan next — which should I do?

# QrMenu-1
