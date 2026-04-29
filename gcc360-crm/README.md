# GCC360 CRM — Enterprise Sales Platform

A premium enterprise CRM built for Oil & Gas companies in the GCC region.

## Quick Start

```bash
cd gcc360-crm
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Login Flow

1. **Login Page** — Enter any credentials (mock auth)
2. **Role Selection** — Choose from 5 roles:
   - Administrator
   - Sales Manager
   - Salesperson
   - Finance
   - Analyst
3. **Face ID Verification** — Mock biometric animation (~4 seconds)
4. **Main Application**

## Features

| Module | Description |
|--------|-------------|
| Dashboard | Executive KPIs, pipeline chart, revenue trend |
| Pipeline | Kanban board with 4 deal stages |
| Leads | Lead table with AI credibility scores, qualify action |
| Clients | Client cards with tier badges (Platinum/Gold/Silver) |
| Contacts | Contact directory linked to companies |
| Opportunities | Full opportunity list + **AI Quote Generator** |
| Deals | Deal tracking and history |
| Tasks | Task management with priority levels |
| Activities | Activity feed (calls, emails, meetings, notes) |
| AI Quotes | AI-powered pricing scenarios (Primary/Conservative/Aggressive) |
| Analytics | Revenue by region, win rate, lead funnel, pipeline trend |
| Finance | Invoice management with status updates |
| Users | User & role management (Admin only) |

## AI Quote Generator

Navigate to **Opportunities** → click **Generate** on any row to:
1. Watch AI loading animation
2. See 3 pricing scenarios (Primary, Conservative, Aggressive)
3. Review confidence scores, margin, VAT, and AI justification

## AI Assistant

Click **AI Assistant** in the top header and ask:
- "What is the total pipeline value?"
- "Which deals are at risk?"
- "Revenue this quarter?"
- "Top performing salesperson?"

## Tech Stack

- React 18 + Vite
- TypeScript (strict)
- Tailwind CSS v3
- Framer Motion
- Recharts
- Lucide React
- All mock data — no backend required

## Currency

All values displayed in **AED** (UAE Dirham) with M/K formatting.
