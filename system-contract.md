# SYSTEM_CONTRACT.md

# CARE Accommodation Management System (CAMS)

Version: 2.0

---

# Purpose

This document is the single source of truth for CAMS.

Both the frontend and backend MUST follow this specification.

CAMS supports guest booking requests. Staff approval creates the actual room booking.

---

# System Overview

CAMS is an accommodation management system for CARE Kenya facilities.

Multiple camps are supported. Each booking belongs to exactly one camp.

Guests can submit booking requests through the public guest portal. Accommodation Officers review requests, assign available rooms, and create bookings.

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

Can submit a booking request through the guest portal and receive request and booking-status emails.

---

# Booking Workflow

1. Guest submits a booking request with their requested camp, stay type, and dates.
2. Guest receives an acknowledgement email; active Accommodation Officers/Super Admins and the support address receive a separate action-needed email.
3. An officer reviews the request and selects an available room for the requested camp and dates.
4. The officer completes the request. The system creates the booking with status **Booked** and emails the guest a confirmation and, for billable bookings, a PDF invoice attachment.
5. The officer checks the guest in → **Checked In**, then checks the guest out → **Checked Out**.

Guest requests do not reserve rooms and remain separate from booking statuses until completed by staff.

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

Per camp: Short Stay Rate per night, Long Stay Rate per month. Long Stay bookings are billed by whole months; CARE Staff bookings are waived and do not display rates.

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
