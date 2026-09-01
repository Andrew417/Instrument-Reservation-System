# Instrument Reservation System

A comprehensive church instrument reservation and equipment management web application built with React 19, Vite, Express, PostgreSQL, and Drizzle ORM.

---

## Quick Local Setup (Under 5 Minutes)

### 1. Prerequisites
- **Node.js**: v20.x or v22.x+
- **PostgreSQL**: Local PostgreSQL server, Docker, or a hosted PostgreSQL instance (e.g. Neon)

---

### 2. Start PostgreSQL Database

#### Option A: Using Docker (Fastest)
```bash
docker run --name church-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=instrument_reservations -p 5432:5432 -d postgres:16-alpine
```

#### Option B: Using Hosted Neon DB (No Local DB install needed)
Create a free database at [neon.tech](https://neon.tech) and copy your connection string.

---

### 3. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install
```

---

### 4. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Open `.env.local` and set:
```env
# Local Docker or local Postgres:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/instrument_reservations"

# Super Admin Credentials (required for initial seed)
SUPER_ADMIN_EMAIL="admin@church.org"
SUPER_ADMIN_PHONE="01000000000"
SUPER_ADMIN_NAME="Super Administrator"
SUPER_ADMIN_PASSWORD="StrongPassword123!"

# Resend API Key for Password Reset OTP emails (optional in local dev)
RESEND_API_KEY=""
RESEND_FROM_EMAIL="St. Mark Reservations <onboarding@resend.dev>"

NODE_ENV="development"
```

---

### 5. Push Database Schema & Seed Super Admin

```bash
# Push database schema to PostgreSQL
npm run db:push

# Seed the Super Admin account
npm run seed:admin
```

---

### 6. Start the Development Server

```bash
npm run dev
```

The application will start on **`http://localhost:3000`** with full Vite HMR, Express API routes, and live PostgreSQL connection.

---

## Available Scripts

| Command              | Description                                                                     |
| :------------------- | :------------------------------------------------------------------------------ |
| `npm run dev`        | Starts the unified Express + Vite development server on `http://localhost:3000` |
| `npm run db:push`    | Pushes the Drizzle ORM schema changes directly to PostgreSQL                    |
| `npm run db:studio`  | Opens Drizzle Studio to inspect and edit database records visually              |
| `npm run seed:admin` | Seeds or updates the Super Admin user in PostgreSQL from environment variables  |
| `npm run lint`       | Runs TypeScript type-checking without emitting files (`tsc --noEmit`)           |
| `npm run build`      | Compiles the client SPA into `/dist` and bundles the server                     |
| `npm start`          | Starts the production server bundle                                             |

ready for production
