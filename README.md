# NDMII Platform

Nigeria Digital MSME Identity Infrastructure Initiative (NDMII)

A national digital identity infrastructure platform for MSMEs, artisans, manufacturers, cooperatives, and service providers across Nigeria.

This platform enables:

• MSME digital identity issuance
• QR-based verification
• regulator workflows (FCCPC, NRS)
• association onboarding
• simulated tax/VAT compliance tracking
• complaint management
• manufacturer traceability
• analytics dashboards
• public verification portal

This repository contains the production-grade MVP system designed for demonstration to:

FCCPC  
NRS  
SMEDAN  
SON  
NAFDAC  
Presidency stakeholders  

---

## Tech Stack

Frontend:
Next.js (App Router)
TypeScript
TailwindCSS
shadcn/ui

Backend:
Next.js Server Actions + API routes

Database:
Supabase Postgres

Auth:
Supabase Auth

Storage:
Supabase Storage

Charts:
Recharts

Deployment:
Vercel

---

## Hostname Routing

DBIN uses the Next.js 16 Proxy convention for hostname rewrites, exposing dedicated production surfaces without moving or duplicating the existing application routes.

| Hostname | Public route | Internal route | Purpose |
| --- | --- | --- | --- |
| `dbin.ng`, `www.dbin.ng` | `/` | `/` | Public marketing website |
| `app.dbin.ng` | Any existing path | Unchanged | Existing DBIN application |
| `admin.dbin.ng` | `/` | `/admin` | Admin portal gateway |
| `admin.dbin.ng` | `/associations/*` | `/admin/associations/*` | Existing admin association tools |
| `verify.dbin.ng` | `/` | `/verify` | Public verification portal |
| `verify.dbin.ng` | `/c/*` | `/verify/c/*` | Secure credential verification |
| `localhost`, `127.0.0.1`, `::1` | Any existing path | Unchanged | Local app behavior |

Set the `DBIN_*_HOSTS` variables documented in `.env.example` when custom preview or production hostnames are required. Set `DBIN_AUTH_COOKIE_DOMAIN=.dbin.ng` in production so the existing Supabase session cookies are available to the app and admin subdomains; leave it unset locally.

All rewrites preserve the incoming request, query string, cookies, authentication refresh, API paths, and existing server-side RBAC guards. DNS and deployment configuration must attach all four production hostnames to the same Next.js deployment.

---

## Target MVP Capabilities

MSME onboarding  
Digital ID issuance  
QR verification  
NIN/BVN/CAC/TIN simulation  
Reviewer workflow  
Regulator dashboard  
Complaint logging  
Mock tax/VAT payments  
Executive analytics dashboard  
Manufacturer traceability  

---

## Deployment Target

Production-ready demo environment within 1 day

---

## Demo MSME Provider Accounts

All demo accounts use password: `Demo@123456`

- `msme.demo@ndmii.ng` → `NDMII-LAG-0003` (MSME baseline account)
- `msme.eko@ndmii.ng` → `NDMII-LAG-0001` (provider-linked MSME demo)
- `msme.arewa@ndmii.ng` → `NDMII-KAN-0004` (provider-linked MSME demo)
- `msme.fct@ndmii.ng` → `NDMII-FCT-0010` (provider-linked MSME demo)
