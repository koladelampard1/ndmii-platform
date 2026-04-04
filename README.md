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
