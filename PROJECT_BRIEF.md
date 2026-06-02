# Devotion Ventures — Kod-test: Mini ATS

## Bakgrund

Bygg ett mini-ATS (applicant tracking system) som kan vara live i händerna på en första kund så snabbt som möjligt.

---

## Core features

| # | Roll | Funktion |
|---|------|----------|
| 1 | Admin | Skapa konton (admin-konton & kund-konton) |
| 2 | Kund | Logga in |
| 3 | Kund | Lägga upp jobb man söker kandidater till |
| 4 | Kund | Lägga till kandidater med profilinformation (t.ex. LinkedIn-länk) |
| 5 | Kund | Se en kompakt kanban-vy med alla kandidater |
| 6 | Kund | Filtrera kanban-vyn på jobb & kandidatnamn |
| 7 | Admin | Göra allt kunder kan göra, åt dem |

---

## Extra uppgift — AI-feature

Implementera en enkel/avskalad funktion för **bedömning av kandidatens CV med hjälp av AI**.

Minimikrav: berätta i demon hur du hade angripit problemet.

---

## Guidelines

- Använd **Supabase** som backend (authentication & databas)
- Använd AI-verktyg maximalt för att bygga snabbt (Lovable, Cursor, Claude Code, Codex, Copilot, etc.)
- Fria antaganden kring kunder, önskemål och behov är tillåtna
- Bygg gärna ut ytterligare ATS-funktionalitet om tid finns

---

## Leverans

- [ ] Dela **admin login** till plattformen
- [ ] Spela in en **5 min demo-video** (Loom eller liknande) och dela länken
- [ ] Dela **antaganden** du gjort i ett mejl
- [ ] Dela **länk till repot**
- [ ] Shippa gärna ofta — flera leveranser är välkomna

**Deadline:** 1 vecka

---

## Status — vad som är byggt

### Klart

- [x] Supabase-integration (auth + databas)
- [x] Login-sida (email/password via Supabase Auth)
- [x] Rollsystem: `admin` / `customer` via `public.profiles`
- [x] Admin: hantera kunder (lista, skapa, ta bort)
- [x] Admin: "Acting as"-switcher — arbeta i en kunds kontext
- [x] Jobb: skapa och lista jobb per kund
- [x] Kandidater: lägga till kandidater med LinkedIn-länk och profilinformation
- [x] Kanban-vy med kandidater per stage
- [x] Filtrera kanban på jobb & kandidatnamn

### Återstår / pågår

- [ ] Admin: skapa kund-konton via UI (knappen "Create account" är stub)
- [ ] AI-bedömning av kandidat-CV
- [ ] Demo-video (Loom)
- [ ] Slutlig leverans via mejl

---

## Tech stack

| Lager | Val |
|-------|-----|
| Frontend | React 19 + TanStack Router/Start |
| UI | shadcn/ui + Tailwind 4 + Radix |
| Backend / Auth | Supabase (PostgreSQL + Supabase Auth) |
| Build | Vite 7 + Bun |
| Deploy | (Lovable / Cloudflare via Nitro) |

---

## Datamodell (Supabase)

```
auth.users          — hanteras av Supabase Auth
public.profiles     — id (= auth.users.id), role, customer_id, full_name, email
public.customers    — id, name, created_at
public.jobs         — id, customer_id, title, description, status, created_at
public.candidates   — id, job_id, customer_id, name, email, stage, cv_url,
                      linkedin_url, notes, ai_assessment, created_at
```

Stages (kanban-kolumner): `Ny → Screening → Intervju → Erbjudande → Anställd / Avslag`
