# Refúgio da Beleza — PRD (MVP)

## Overview
Mobile app (React Native / Expo) for the beauty salon "Refúgio da Beleza" in Santa Bárbara d'Oeste, SP. Target: women 20-55. Services: hair, nails, waxing. CLIENT profile only in MVP.

## Stack
- Expo Router (file-based), React Native, Reanimated, @gorhom/bottom-sheet
- FastAPI + MongoDB (motor)
- JWT auth (email/password), Argon2 password hashing (pwdlib)
- Emergent Object Storage for profile photos
- expo-image-picker for gallery uploads
- Push notifications: MOCKED (visual only)

## Design
Editorial feminine palette from `/app/design_guidelines.json`: soft rose (#DDA7A5), gold (#D4B483), warm off-white (#FAFAF7), deep brown text (#2C2621). Playfair Display serif for headers (Georgia fallback), Satoshi sans (System fallback).

## Screens (all built)
- `auth/login` — email/password with "esqueci minha senha" link
- `auth/register` — nome, telefone, e-mail, senha + LGPD checkbox
- `auth/forgot-password` — email input; MVP returns generic success
- `(tabs)/index` (Home) — greeting, hero promo banner, quick book shortcut, category carousel, featured services
- `(tabs)/catalog` — category chips (Cabelo/Unhas/Depilação), multi-select services, sticky book CTA
- `(tabs)/appointments` — segmented Futuros/Histórico, cancel/reschedule with 24h rule
- `(tabs)/profile` — editable name/phone/email, avatar upload (Object Storage), procedure history, sign out
- `booking` — professional (optional, "sem preferência"), horizontal date strip (14 days), time pills grid, confirm CTA
- `confirmation` — success screen with summary (services, professional, date, time, total)

## Backend endpoints (`/api`)
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/forgot-password`, `GET /auth/me`, `PATCH /auth/me`, `POST /auth/me/photo`, `GET /files/{path}`
- Catalog: `GET /services?category=&featured=`, `GET /professionals`
- Booking: `GET /availability?date=&professional_id=`, `POST /appointments`, `GET /appointments?scope=upcoming|past|all`, `POST /appointments/{id}/cancel`, `POST /appointments/{id}/reschedule`

## Data model (MongoDB)
- **users**: _id, name, phone, email (unique), password_hash, photo_path, created_at, lgpd_accepted_at
- **services**: _id, category, name, description, duration_min, price, image_url, featured (seeded 12)
- **professionals**: _id, name, specialties[], photo_url (seeded 4)
- **appointments**: _id, user_id, service_ids[], professional_id, date, time, total_duration_min, total_price, status, created_at

## Business rules
- 24h minimum for cancel/reschedule
- Cannot book in the past
- Slot conflict blocked only when professional is specified
- Business hours 09:00-18:30 every 30 min

## MOCKED
- Push notifications: no scheduling; app shows an info banner on the confirmation screen only
- Forgot password: always returns success; no SMTP email is sent
