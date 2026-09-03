# SYSTEM_CONTRACT.md

# CARE Accommodation Management System (CAMS)

Version: 2.0

---

# Purpose

This document is the single source of truth for CAMS.

Both the frontend and backend MUST follow this specification.

CAMS Version 2 replaces all Version 1 requirements. Public booking, approval workflows, and guest self-service are retired.

---

# System Overview

CAMS is an internal accommodation management system for CARE Kenya facilities.

Multiple camps are supported. Each booking belongs to exactly one camp.

Guests do not access the application. Accommodation Officers create bookings on behalf of guests.

---

# Technology

## Frontend

- HTML, CSS, Vanilla JavaScript, Fetch API

## Backend

- Node.js, Express.js, MongoDB, Mongoose (backend repository)

---

# API

- Base path: `/api/v1/`
- All endpoints are private except `POST /auth/login`
- JSON requests and responses
- JWT authentication
- Response shape:

```json
{ "success": true, "message": "…", "data": {} }
{ "success": false, "message": "…", "errors": [] }
```

---

# User Roles

## Accommodation Officer

Can: login, create/edit/cancel bookings, check-in, check-out, view bookings, view invoices.

Cannot: manage camps, blocks, rooms, rates, reports, users, or system settings.

## Super Admin

Everything Accommodation Officer can do, plus: manage users, camps, blocks, rooms, rates, payment settings, reports, and system settings.

## Guest

No account. No login. No application access. Interacts via email only.

---

# Booking Workflow

1. Accommodation Officer logs in
2. Creates booking (camp → block → room → stay type)
3. Booking is created immediately with status **Booked**
4. Guest receives confirmation email
5. Officer checks guest in → **Checked In**
6. Officer checks guest out → **Checked Out**
7. Invoice generated automatically on check-out
8. Invoice emailed to guest and creating officer

There is NO approval workflow. There is NO Pending Review status.

---

# Booking Statuses

Only valid statuses:

- Booked
- Checked In
- Checked Out
- Cancelled

---

# Camps

Supported facilities (extensible):

- CARE Dadaab
- CARE Hagadera
- CARE Ifo

Each booking belongs to exactly one camp. Bookings cannot span camps.

---

# Blocks

Blocks belong to a camp. Block names may repeat across camps.

Managed by Super Admin. Not hardcoded.

---

# Rooms

Rooms belong to a block (and camp through the block).

Uniqueness: Camp + Block + Room Number.

Room statuses: **Available**, **Maintenance** only.

Occupancy is never stored on rooms; it is calculated from active bookings.

---

# Stay Types

- Short Stay
- Long Stay

Selected manually by the officer. Never auto-determined from nights.

---

# Rates

Per camp: Short Stay Rate, Long Stay Rate.

Super Admin only. Never hardcoded.

Each booking stores `appliedRate` at creation time. Historical bookings and invoices are unaffected by future rate changes.

---

# Guest Fields

firstName, lastName, email, phone, organisation, gender, contractType, reasonForVisit, arrivalDate, departureDate, driverPickup, departureCountry, remarks.

---

# Booking Reference

Format: `CARE-YYYYMMDD-XXXXXX` (e.g. CARE-20260717-000123). Globally unique. No camp code.

---

# Booking Editing

**Booked:** all guest and accommodation fields editable.

**Checked In:** guest fields editable; camp, block, room, stay type, arrival, departure locked.

**Checked Out / Cancelled:** not editable.

---

# Cancellation

Officer cancels directly. Reason required. Status → Cancelled. Guest receives email. Audit log records who, when, reason.

---

# Invoices

Generated automatically on check-out.

Recipients: guest + officer who created the booking.

Contains: invoice number, booking reference, guest details, camp, block, room, dates, nights, stay type, applied rate, total, payment instructions.

Invoice numbers: `INV-YYYY-XXXXXX` (sequential, unique).

Payments are NOT processed in v2. Instructions only.

---

# Payment Settings (global)

Super Admin configures: M-Pesa Paybill, bank name, account name, account number. Shown on all invoices.

---

# Reports (Super Admin)

Types: bookings by camp, by date range, short vs long stay, room utilization, occupancy, revenue, outstanding invoices, arrivals, departures.

Filters: date range, camp, stay type, status. Export PDF and Excel.

---

# Dashboard

Today's arrivals, today's departures, occupied/available rooms, outstanding invoices, recent bookings, bookings by camp.

---

# Naming Convention

camelCase: bookingReference, arrivalDate, campId, blockId, roomId, stayType, appliedRate, etc.

---

# Out of Scope (v2)

Online payments, guest accounts, public booking, SMS, mobile app.

---

# Development Rule

If requirements conflict with this document: stop, ask for clarification, do not invent business rules.
