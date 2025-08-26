# Overview

This is a QR Menu SaaS application that allows restaurant owners to create contactless, editable digital menus. Restaurant owners can sign up, create restaurants with unique slugs, add menu items with prices and descriptions, and generate QR codes that customers can scan to view menus and calculate order totals. The application provides a complete solution for modern contactless dining experiences.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system variables
- **State Management**: TanStack Query for server state management and React hooks for local state
- **Form Handling**: React Hook Form with Zod validation schemas

## Backend Architecture
- **Server**: Express.js with minimal server-side logic
- **Database Access**: Designed to work with both Supabase (primary) and Drizzle ORM with PostgreSQL
- **Authentication**: Supabase Auth handles user authentication and session management
- **API Design**: RESTful endpoints with most data operations handled client-side through Supabase

## Data Storage
- **Primary Database**: Supabase (PostgreSQL) for production data storage
- **Schema**: Drizzle ORM schema definitions for type safety and migrations
- **Tables**: 
  - `profiles`: User profile information
  - `restaurants`: Restaurant details with owner relationships
  - `menu_items`: Individual menu items linked to restaurants
- **Backup Storage**: In-memory storage implementation for development/testing

## Authentication & Authorization
- **Provider**: Supabase Auth with email/password authentication
- **Session Management**: Automatic session handling with React context
- **Access Control**: Row-level security through Supabase policies
- **User Flow**: Sign up, email verification, sign in, and dashboard access

## External Dependencies

### Core Services
- **Supabase**: Backend-as-a-Service for authentication, database, and real-time features
- **Neon Database**: PostgreSQL database hosting (alternative to Supabase database)

### UI & Design
- **Radix UI**: Accessible component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework for styling
- **shadcn/ui**: Pre-built component library for consistent design
- **Lucide React**: Icon library for UI elements

### Development Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety across the application
- **Drizzle Kit**: Database schema management and migrations
- **ESBuild**: JavaScript bundler for production builds

### Additional Libraries
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form handling and validation
- **Zod**: Schema validation for type safety
- **QRCode.react**: QR code generation for menu links
- **date-fns**: Date manipulation utilities
- **Wouter**: Lightweight routing solution