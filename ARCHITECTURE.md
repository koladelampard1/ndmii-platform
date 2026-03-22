NDMII System Architecture

Frontend

Next.js App Router
TypeScript
TailwindCSS
shadcn/ui

Backend

Next.js API routes
Server actions

Database

Supabase PostgreSQL

Tables

users
msmes
associations
complaints
payments
compliance_profiles
manufacturer_profiles
activity_logs

Identity Engine

MSME ID format:

NG-MSME-STATE-SECTOR-XXXX

Example:

NG-MSME-LAG-TECH-0001

Verification Engine

QR code generation
Public lookup endpoint

Integration Adapters

ninAdapter.ts
bvnAdapter.ts
cacAdapter.ts
tinAdapter.ts

Adapters simulate:

match found
no match
pending validation

Dashboards

Admin dashboard
Regulator dashboard
Association dashboard

Charts

Recharts

Deployment

Frontend: Vercel
Backend: Supabase
Storage: Supabase Storage
