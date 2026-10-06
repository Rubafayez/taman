<p align="center">
  <img src="taman-logo.png" width="340" alt="Ta'man logo">
</p>

<h1 align="center">Ta'man — تأمن</h1>

<p align="center">
  <b>A campus lost-and-found platform for King Saud University.<br>
  Photograph the item and the report writes itself, reports are matched by meaning rather than
  wording, and the handover is confirmed by both sides.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white">
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white">
  <img src="https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white">
  <img src="https://img.shields.io/badge/Netlify-00C7B7?style=flat-square&logo=netlify&logoColor=white">
  <img src="https://img.shields.io/badge/Arabic_RTL-success?style=flat-square">
</p>

<p align="center">
  <a href="https://tamanrksu.netlify.app"><b>Live demo →</b></a>
</p>

---

## The problem

Lost items on campus are reported in scattered WhatsApp groups and at lost-and-found desks spread
across separate buildings. There is no single place to search, reporting an item you found takes
enough effort that most students skip it, and "lost" and "found" reports are never connected to
each other.

The more serious problem is a quieter one. Anyone who reads a public description can repeat it back
and claim the item. **The risk is not that the item never comes back — it is that it comes back to
the wrong person.**

**Ta'man** ("be reassured" in Arabic) is built around that second problem: every feature either
shortens the path between the two students, or makes sure the item reaches the person who actually
owns it.

---

## How it works

1. **Report** — choose lost or found, then photograph the item or describe it.
2. **Match** — the opposite reports are surfaced, ranked by a match score.
3. **Verify** — the reporter sets a question only the real owner can answer.
4. **Hand over** — a handover code and confirmation from both parties before the report closes.

---

## AI features

| Feature | What it does |
|---|---|
| **Photo to report** | A photo of the item is analysed and the category, title and description are filled in automatically. The student reviews and edits before publishing. |
| **Semantic matching** | Every report is embedded and stored in `pgvector`, so "white wireless earbuds" matches "AirPods" despite sharing no words. The final score combines explicit rules (category, location, date) with semantic similarity. |
| **Privacy guardian** | Reviews the description before publishing: it flags phone numbers, ID numbers and other people's names, and detects details so specific that an impostor could repeat them to claim the item — offering to **move that detail into the verification question** instead of deleting it, turning a leak into proof of ownership. Uploaded photos are checked too, so identity documents are never published. |
| **Claim assessment** | An advisory indicator that compares a claimant's answer against the item description. It never approves or rejects — the decision stays with the reporter. |

---

## Privacy and safety

- **No accounts.** Identity is a locally generated device id; no personal data is collected.
- **Contact details are never public** and are revealed only after a claim is approved.
- **Two-sided handover.** A report cannot be closed by one party clicking a button — both sides
  confirm, using a handover code exchanged in person.
- **The Gemini key stays on the server** (`netlify/functions/gemini.ts`) and never reaches the browser.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite |
| **Styling** | Tailwind CSS 4 — dark theme, Arabic RTL, mobile-first |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **Vector search** | `pgvector` with an HNSW index and a `match_items` RPC |
| **Realtime** | Supabase Realtime — new reports and claims appear without a refresh |
| **Storage** | Supabase Storage — item photos |
| **AI** | Gemini via `@google/genai`, proxied through a Netlify Function |
| **Hosting** | Netlify |

---

## Project Structure

```
src/
├── components/                  Screens and presentational components
│   ├── FeedScreen.tsx           Browse, search and filter reports
│   ├── PostScreen.tsx           Create a report, photo analysis, privacy guardian
│   ├── DetailScreen.tsx         Report details, matches, claim flow
│   ├── MyItemsScreen.tsx        Profile, my reports, incoming claims
│   ├── PrivacyGuardianPanel.tsx Inline privacy review panel
│   ├── ClaimReviewCard.tsx      Claim review with the advisory indicator
│   └── HandoverStepper.tsx      Four-step handover progress
│
├── services/
│   ├── aiService.ts             Every model call — photo analysis, embeddings,
│   │                            privacy review, claim assessment
│   ├── itemsService.ts          The only data access layer (Supabase)
│   ├── profileService.ts        Device-scoped profile and saved contact details
│   └── itemMapper.ts            snake_case ⇄ camelCase mapping
│
├── utils/                       Matching score and input validation
└── config/                      Constants and Arabic strings

netlify/functions/gemini.ts      Server-side AI proxy — holds the API key
supabase_rls_policies.sql        Schema, indexes, RPC and access policies
```

---

## Getting Started

### Prerequisites

- Node.js 20 or newer
- A Supabase project
- A Gemini API key

### Setup

**1. Install dependencies**

```bash
npm install
```

**2. Prepare the database**

Run `supabase_rls_policies.sql` in the Supabase SQL editor. It creates the `items`, `claims` and
`profiles` tables, enables `pgvector`, adds the HNSW index and the `match_items` function, and sets
the access policies and the storage bucket for photos.

**3. Add your environment variables**

Create `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
GEMINI_API_KEY=...
```

**4. Run it**

```bash
npm run dev
```

---

## Deployment

The project is configured for Netlify: the frontend is built to `dist`, and AI requests are routed
through a serverless function so the Gemini key is never shipped to the browser. Add
`GEMINI_API_KEY` to the site's environment variables.

---

## Repository Notes

Environment files are excluded from version control. The Supabase anon key is public by design and
protected by Row Level Security; the Gemini key is server-side only. Built during the BUILDx
hackathon.
