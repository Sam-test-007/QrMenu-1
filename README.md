# QR Menu (Admin Dashboard)

**Overview**

- **Project:** QR Menu — an admin dashboard for managing restaurants, menu items, orders, and QR code generation.
- **Stack:** Built with React and TypeScript (TSX), utilizing Vite for development, Supabase for database and storage, and styled with Tailwind CSS and custom UI components.

**Key Features**

- **Responsive Design:** Collapsible menu panel for desktop and a bottom sheet for mobile, ensuring a user-friendly experience across devices.
- **Order Tracking:** Real-time counter for completed orders, updating every minute and resetting daily at midnight.
- **Optimistic UI Updates:** Immediate visual feedback for order completion, enhancing user experience.
- **QR Code Generation:** Users can download a PNG that combines a QR code with the restaurant name and table number.
- **Onboarding Tour:** A guided tour for first-time users, saved in local storage for easy access.
- **Accessibility Enhancements:** Improved ARIA attributes, live announcements, and keyboard navigation support.
- **Sales Overview:** Display of total sales in the restaurant header, aggregating order totals.
- **Bug Fixes:** Resolved JSX parsing errors and improved overall stability.

**Files Modified**

- [client/src/components/admin-dashboard.tsx](client/src/components/admin-dashboard.tsx) — Enhanced the menu for responsiveness, added onboarding features, a focus trap, daily order counter, total sales display, and fixed JSX issues.
- [client/src/components/qr-code-generator.tsx](client/src/components/qr-code-generator.tsx) — Implemented QR code composition for download, integrating restaurant name and table number.

**Local Setup & Run**

To set up the project locally, install the necessary dependencies and start the development server:

```bash
npm install
npm run dev
```

Follow the instructions above to get started with the QR Menu project.
