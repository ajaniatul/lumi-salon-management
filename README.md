# Lumi by Beauvé — Salon Management System

Full-stack salon management app: appointments, billing/invoicing, customers, staff, inventory, purchases, expenses, petty cash, commissions, attendance, memberships, packages, loyalty, reports and analytics.

## Stack

- Next.js 14 (App Router) + TypeScript
- Prisma ORM + PostgreSQL (built and tested against [Neon](https://neon.tech))
- JWT auth via httpOnly cookies, role-based access control (Admin / Manager / Receptionist / Stylist)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your own values:
   - `DATABASE_URL` / `DIRECT_URL` — your PostgreSQL connection strings
   - `JWT_SECRET` — a long random string (used to sign session tokens)
   - The rest (Cloudinary, WhatsApp, SMS, Email) are **optional integrations — see "Known limitations" below.**
3. `npm run db:generate` — generate the Prisma client
4. `npm run db:push` — create the schema on your database (or `npm run db:migrate` to apply the versioned migrations in `prisma/migrations`)
5. `npm run db:seed` — load demo data (staff, services, products, customers, settings)
6. `npm run dev` — starts at http://localhost:3000

## Demo logins

Seeded by `npm run db:seed`. Change or remove these before giving real people access.

| Role | Email | Password |
|---|---|---|
| Admin | admin@salon.com | admin123 |
| Manager | manager@salon.com | manager123 |
| Receptionist | reception@salon.com | recept123 |
| Stylist | stylist@salon.com | stylist123 |

## What's real vs. placeholder

Every page in the dashboard reads and writes real data through Prisma/PostgreSQL — nothing resets on refresh. The one thing to know before going live:

- **Cloudinary, WhatsApp (Meta), SMS (MSG91), and Email (Resend)** are configured as environment-variable placeholders (`.env.example`) but **not wired into any feature**. No image uploads, WhatsApp reminders, SMS, or emails are actually sent by the app today. Building those out is a separate piece of work — the `.env` slots are there for when you're ready.

## Deploying

This pass focused on getting the app fully working and committed to git — it hasn't been deployed anywhere yet. When you're ready to go live:

1. Provision a production Postgres database (a separate Neon project, or any Postgres host) — don't reuse your dev database.
2. Deploy to [Vercel](https://vercel.com) (or any Node host that supports Next.js 14): connect this repo, set the environment variables from `.env.example` with real production values, and set `NODE_ENV=production`.
3. Run `npx prisma migrate deploy` against the production database, then `npm run db:seed` only if you want the demo data — otherwise start with a clean database.
4. Rotate `JWT_SECRET` to a fresh value for production (don't reuse the dev one).

## Useful scripts

- `npm run build` / `npm run start` — production build/start
- `npm run db:studio` — browse the database with Prisma Studio
- `npm run lint` — ESLint
