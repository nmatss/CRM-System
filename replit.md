# Moda CRM

## Overview

Moda CRM is a retail Customer Relationship Management system designed for fashion/clothing stores. It provides tools for customer management, sales tracking, marketing automation, cashback/loyalty programs, and seller productivity through features like the "Agenda do Vendedor" (Seller's Agenda) for clienteling tasks.

The application is built as a full-stack TypeScript project with a React frontend and Express backend, using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Build Tool**: Vite with custom plugins for Replit integration
- **Animations**: Framer Motion for UI animations

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API endpoints under `/api/*`
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Validation**: Zod with drizzle-zod integration
- **Development**: tsx for TypeScript execution, hot module replacement via Vite

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Data access layer
│   └── db.ts            # Database connection
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle database schema
└── migrations/          # Database migration files
```

### Data Models
The system manages these core entities:
- **Users**: Authentication and user management
- **Customers**: Customer profiles with segmentation, LTV tracking
- **Products**: Product catalog with stock management
- **Orders**: Sales transactions
- **Cashback Rules**: Loyalty program configurations
- **Campaigns**: Marketing campaigns (WhatsApp, Email, SMS)
- **Automations**: IFTTT-style automation rules

### Key Design Decisions
1. **Monorepo Structure**: Frontend and backend share TypeScript types through the `shared/` directory
2. **Path Aliases**: `@/` for client code, `@shared/` for shared code
3. **Component Library**: shadcn/ui provides consistent, accessible UI components
4. **API Pattern**: Simple REST endpoints with Zod validation for request/response
5. **Development Mode**: Vite dev server with HMR proxied through Express

## External Dependencies

### Database
- **PostgreSQL**: Primary database (connection via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Type-safe database queries and migrations
- **connect-pg-simple**: Session storage in PostgreSQL

### UI Framework
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Recharts**: Charting library for reports/dashboard

### Third-Party Integrations (Configured in dependencies)
- **WhatsApp**: Deep linking for seller messaging (`wa.me` protocol)
- **Potential integrations**: OpenAI, Stripe, Nodemailer (dependencies present but implementation varies)

### Build & Development
- **Vite**: Frontend bundler with React plugin
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development

## Documentation

- **Database Schema**: See `docs/DATABASE.md` for complete database documentation including:
  - Table definitions and relationships
  - ERD diagram
  - Data import API specifications (future)
  - Multi-tenant architecture details