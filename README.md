# CAMS — CARE Accommodation Management System

Vanilla HTML, CSS, and modular JavaScript frontend for the CARE Kenya internal accommodation management system.

Consumes a private REST API at `/api/v1/`. No backend code lives in this repository.

## Stack

- HTML, CSS, Vanilla JavaScript (ES modules), Fetch API

## Entry point

- Root (`index.html`) redirects to `admin/login.html`
- Staff-only application — no public guest pages

## Admin pages

| Page | File | Access |
|------|------|--------|
| Login | `admin/login.html` | Public |
| Dashboard | `admin/dashboard.html` | Staff |
| Bookings | `admin/bookings.html` | Staff |
| Create Booking | `admin/booking-create.html` | Staff |
| Edit Booking | `admin/booking-edit.html` | Staff |
| Invoices | `admin/invoices.html` | Staff |
| Camps | `admin/camps.html` | Super Admin |
| Blocks | `admin/blocks.html` | Super Admin |
| Rooms | `admin/rooms.html` | Staff (manage: Super Admin) |
| Rates | `admin/rates.html` | Super Admin |
| Reports | `admin/reports.html` | Super Admin |
| Users | `admin/users.html` | Super Admin |
| Settings | `admin/settings.html` | Super Admin |
| Change Password | `admin/change-password.html` | Staff |

## Setup

```bash
npx serve .
```

Configure API base URL in `js/config.js`:

```js
API_BASE_URL: 'http://localhost:5000/api/v1'
```

Or at runtime before modules load:

```html
<script>window.__API_BASE_URL__ = 'https://api.example.com/api/v1';</script>
```

## Project structure

```
css/                 Design system and layout
js/config.js         API base URL and app constants
js/api/              REST API wrappers
js/auth/             Session / JWT helpers
js/components/       Toast, modal, loading, shell, camp selectors
js/utils/            Validation, formatting, constants
js/pages/            Page-specific UI logic
admin/               Admin HTML pages
system-contract.md   Source of truth (CAMS v2)
```

## API overview

All endpoints require authentication except `POST /auth/login`.

See `system-contract.md` for full business rules and `js/api/` for client wrappers.

### Auth

- `POST /auth/login` — `{ email, password }` → `{ token, user }`
- `GET /auth/me`
- `PATCH /auth/change-password` — `{ currentPassword, newPassword }`

### Bookings

- `GET /bookings` · `GET /bookings/:id`
- `POST /bookings` · `PUT /bookings/:id`
- `POST /bookings/:id/cancel` · `POST /bookings/:id/check-in` · `POST /bookings/:id/check-out`

### Camps & Blocks

- `GET|POST|PUT|DELETE /camps` · `GET|POST|PUT|DELETE /camps/:campId/blocks`

### Rooms

- `GET /rooms` · `GET /rooms/available` · `GET|POST|PUT|DELETE /rooms/:id`

### Rates (per camp)

- `GET /camps/:campId/rates`
- `POST /camps/:campId/rates` — `{ stayType, amount, currency }`

### Bookings

- `GET|POST /bookings` · `GET|PUT /bookings/:id`
- `POST /bookings/:id/cancel` · `POST /bookings/:id/check-in` · `POST /bookings/:id/check-out`

### Invoices

- `GET /invoices` · `GET /invoices/:id` · `GET /invoices/:id?format=pdf`

### Reports (Super Admin)

- `GET /reports/:type?from=&to=&campId=&stayType=&status=&format=json|pdf|xlsx`

### Dashboard

- `GET /dashboard`

### Settings

- `GET|PUT /settings` — payment nested under `payment`

## Roles

- **Accommodation Officer** — bookings, invoices, check-in/out
- **Super Admin** — camps, blocks, rooms, rates, reports, users, settings

## Backend alignment

This frontend targets the CAMS backend at `care-dadaab-accommodation-booking-backend`.

| Setting | Frontend (`js/config.js`) | Backend (`.env`) |
|---------|---------------------------|------------------|
| API base | `http://localhost:5000/api/v1` | `API_PREFIX=/api/v1`, `PORT=5000` |
| CORS | Any static origin | `CORS_ORIGIN=*` (or your frontend URL) |

### Run both locally

```bash
# Backend (from backend repo)
npm run dev

# Frontend (from this repo)
npx serve . -l 3000
```

Open `http://localhost:3000/admin/login.html`. Seed logins: `admin@care.org` / `officer@care.org` with `ChangeMe123!`.

If login fails with **Route not found: POST /api/v1/auth/login**, another app is likely using port 5000. Start the backend on a free port (e.g. `PORT=5001` in backend `.env`) and set the matching URL in `js/config.js`.

### API notes (frontend matches backend)

- Blocks: `GET/POST /camps/:campId/blocks`, not a top-level `/blocks` route
- Dashboard: `GET /dashboard` (not `/dashboard/stats`)
- Rates: `POST /camps/:campId/rates` per stay type (`stayType`, `amount`, `currency`)
- Reports: `GET /reports/:type` with `from`, `to`, `campId`, `stayType`, and `format=json|pdf|xlsx|excel` (no booking status filter on backend)
- Settings payment fields: nested under `payment` (`mpesaPaybillNumber`, `bankName`, etc.)
- Invoices: display email status; use Print or Download PDF in the UI
- Bookings: backend snapshots `appliedRate` on create; do not send `appliedRate` from the form

