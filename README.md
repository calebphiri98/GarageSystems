# Uptown Garage — Garage Management System

A full-service auto workshop system: appointment booking, job cards,
mechanic scheduling, spare-parts ordering and inventory, invoicing, and
role-based portals for customers, mechanics, admins and the manager.

- **Backend:** plain PHP 8 + PDO (Postgres), no framework — see `backend/`
- **Frontend:** React 18 + Vite — see `frontend/`

This zip is meant to be unzipped and run directly. The database
credentials already in `backend/.env` point at the live hosted Postgres
instance, so the backend will work out of the box; you only need to run the
new migration (see below) against that database once.

---

## 1. Database setup

If this is a **brand-new** database, just run the full schema:

```bash
psql "$DATABASE_URL" -f backend/schema.sql
```

If you already have the database running from before, only run the new
migration to pick up this round of changes:

```bash
psql "$DATABASE_URL" -f backend/migrations/003_feature_updates.sql
```

(`002_add_image_support.sql` was the previous round of changes and only
needs running once, if you haven't already.)

### Seeded accounts

`schema.sql` seeds one manager and one admin account, both with the
password **`Passw0rd!`**:

| Role    | Email                          | Password     |
|---------|--------------------------------|--------------|
| Manager | calebphiri98@gmail.com         | `Passw0rd!`  |
| Admin   | calebphiri918@gmail.com        | `Passw0rd!`  |

Change these after first login. To generate a fresh bcrypt hash for any
account (e.g. to reset a password directly in SQL), use:

```bash
php backend/tools/hash_password.php "NewPassword123"
# UPDATE users SET password_hash = '<paste hash>' WHERE email = '...';
```

---

## 2. Backend

The backend needs no `composer install` — it has zero third-party
dependencies (the mailer, JWT, etc. are all hand-rolled to keep deployment
simple).

**Local run (PHP's built-in server):**

```bash
cd backend
php -S localhost:8000
```

**Docker (matches how it's deployed on Render):**

```bash
cd backend
docker build -t garage-backend .
docker run -p 8080:8080 --env-file .env garage-backend
```

Environment variables (`backend/.env`):

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_SSLMODE` | Postgres connection |
| `JWT_SECRET`, `JWT_EXPIRY_HOURS` | Login token signing |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins |
| `CLOUDINARY_*` | Image uploads (parts/services photos) |
| `SMTP_*` | **New.** Outgoing email — used to notify a mechanic by email when assigned to a job. Leave `SMTP_HOST` blank to disable; the app works fine without it (the mechanic still gets an in-app notification either way). |
| `DEFAULT_JOB_DURATION_HOURS` | **New.** Default length of the scheduled work window blocked out when a mechanic is assigned to a job without an explicit duration (default: 2 hours). |

---

## 3. Frontend

```bash
cd frontend
npm install
npm run dev      # local dev server, reads VITE_API_URL from .env
npm run build    # production build -> frontend/dist
```

Set `VITE_API_URL` in `frontend/.env` to wherever the backend is reachable
(e.g. your Render backend URL in production, `http://localhost:8000`
locally).

---

## 4. What changed in this round (supervisor's requested improvements)

**Orders (spare parts)**
- Admin/manager can now **edit** a still-Pending order's line items before confirming it.
- Orders can now be **cancelled** — by the customer while still Pending, or by admin/manager at any point before Completed. Cancelling a Confirmed order automatically restores the reserved stock.
- A customer can **never order more than what's currently in stock** — enforced both in the UI (quantity input is clamped) and on the server (row-locked stock check at order time and at edit time).
- Added **search** and **price-range** filters to the parts catalog (customer ordering page) and to admin Inventory, plus a "low stock only" filter on Inventory.

**Appointments**
- Customers can now **cancel their own appointment** while it's Pending or Confirmed. Admin/manager retain the ability to cancel at any stage before check-in.

**Users**
- **Delete a user** account (admin/manager), with safety checks: deletion is blocked with a clear message if the account still has real business history attached (jobs, appointments, orders, invoices) — deactivate instead in that case. Only a manager can delete another admin/manager account.
- The manager view now has a dedicated **Customers** section to **reactivate** (or deactivate) a customer account, with search.
- Added **search** across staff and customer listings (by name/email/role).

**Mechanic scheduling**
- Assigning a mechanic to a job now books an **assumed time window** (defaults to a 2-hour block starting now, both configurable) and the system **refuses to double-book** a mechanic against another active job whose window overlaps.
- The same "Assign Mechanic" action doubles as **"change mechanic"** — reassigning a job just picks a different mechanic and re-checks for conflicts.
- The assigned mechanic now receives **both** an in-app notification **and an email** (if SMTP is configured) with the job details and scheduled window.

**Security / UX**
- The login form now **clears the password (and, on success, the email) field** immediately after logging in, rather than leaving credentials sitting in the form.
- Fixed the seeded manager/admin accounts, which previously had a placeholder string instead of a real password hash and could not actually log in.

**Branding / landing pages**
- The public landing page now has a clearer hero section, service/parts highlights, and a full **footer with About Us, our location/hours, and contact details**.
- Consistent 🔧 wrench branding across the landing page, login/register screens, and the admin/manager/customer sidebar, so every screen clearly reads as a garage system.
