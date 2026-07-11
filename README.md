# QR Menu – Contactless Digital Menus for Restaurants

A modern SaaS application that empowers restaurant owners to create, manage, and distribute contactless digital menus via QR codes. Customers scan the QR code to view menus and calculate order totals, while restaurant owners maintain full control through an intuitive admin dashboard.

---

## 🎯 Features

### For Restaurant Owners
- **Restaurant Management** – Create and manage multiple restaurants with unique slugs
- **Menu Builder** – Add, edit, and organize menu items with prices and descriptions
- **QR Code Generation** – Generate custom QR codes with restaurant branding and table numbers
- **Admin Dashboard** – Real-time order tracking, sales overview, and analytics
- **Order Tracking** – Real-time counter for completed orders with daily reset at midnight
- **Responsive Design** – Collapsible menu panel for desktop and bottom sheet for mobile

### For Customers
- **Contactless Browsing** – Scan QR codes to view menus instantly (no login required)
- **Order Calculator** – Calculate order totals directly from the menu
- **Mobile-First Experience** – Optimized for all device sizes

### Technical Highlights
- **Optimistic UI Updates** – Immediate visual feedback for user actions
- **Accessibility** – Enhanced ARIA attributes, live announcements, and keyboard navigation
- **Onboarding Tour** – Guided tour for first-time users, saved in local storage
- **Real-Time Updates** – Live data synchronization with Supabase
- **Production Ready** – Comprehensive error handling and stability improvements

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | TypeScript, React, Vite |
| **Styling** | Tailwind CSS, Custom UI Components |
| **Backend/Database** | Supabase (PostgreSQL) |
| **Hosting** | Docker |
| **Build** | Node.js |

**Language Composition:**
- TypeScript: 81.3%
- HTML: 9.1%
- PL/pgSQL: 4.9%
- JavaScript: 3.2%
- CSS: 1.2%
- Dockerfile: 0.3%

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account with database configured

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sam-test-007/QrMenu-1.git
   cd QrMenu-1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env.local` file in the project root:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Docker Deployment

```bash
docker build -t qrmenu .
docker run -p 3000:3000 qrmenu
```

---

## 📁 Project Structure

```
QrMenu-1/
├── client/                          # Frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin-dashboard.tsx  # Restaurant owner dashboard
│   │   │   ├── qr-code-generator.tsx # QR code creation and download
│   │   │   └── ...
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── public/
├── supabase/                        # Database migrations and functions
├── vite.config.ts                   # Vite configuration
├── tailwind.config.ts               # Tailwind CSS configuration
└── package.json
```

---

## 💡 Core Features Explained

### Admin Dashboard
- Real-time order tracking with optimistic UI updates
- Sales overview displaying total revenue
- Responsive navigation (desktop and mobile)
- Onboarding tour for new users
- Accessibility enhancements for keyboard and screen reader users

### QR Code Generation
- Combines QR code with restaurant name and table number
- PNG download for printing and display
- Customizable branding options

### Menu Management
- Full CRUD operations for menu items
- Support for descriptions, pricing, and categories
- Instant updates across all customers viewing the menu

---

## 🔒 Authentication & Security

- Restaurant owners authenticate via Supabase Auth
- Role-based access control (RBAC) for menu and restaurant management
- Customer menu access requires only a QR code scan (no authentication)
- Unique restaurant slugs prevent collisions and enable SEO-friendly URLs

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📋 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 📧 Support & Contact

For questions, bug reports, or feature requests, please open an [issue](https://github.com/Sam-test-007/QrMenu-1/issues) on GitHub.

---

## 🎓 Development Tips

- **Local Development:** Use `npm run dev` for hot module reloading
- **Database Testing:** Set up a Supabase local instance for development
- **Accessibility Testing:** Use browser DevTools and screen readers to verify ARIA attributes
- **Performance:** Use Vite's built-in profiling to monitor bundle size

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.io/docs)
- [React TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/react.html)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Made with ❤️ by Sam-test-007**
