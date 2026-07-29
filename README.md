# HelpHive 🐝

> **Hyperlocal Micro-Task Marketplace & On-Demand Service Dispatch Platform**

HelpHive is a production-grade, real-time Progressive Web Application (PWA) connecting individuals who need help with everyday tasks (**Posters**) with qualified nearby helpers (**Taskers**). Built for high concurrency, sub-second hyperlocal matching, and seamless mobile-first execution.

---

## ⚡ Tech Stack & Architecture

- **Frontend Core**: React 19, Vite 8, TailwindCSS 4
- **State Management & Data**: React Context API, Supabase JS v2
- **Backend & Database**: Supabase (PostgreSQL with GiST spatial indexing & Row Level Security)
- **Real-time Engine**: Postgres Changes Broadcasts & RPC Dispatch Queues
- **Edge Computing & Push Notifications**: Deno-based Supabase Edge Functions, W3C Web Push API, Service Workers
- **PWA Capabilities**: Vite PWA (injectManifest strategy), offline caching, background push notifications

---

## 🏗 Key Features & System Architecture

### 1. 🎯 Hyperlocal Wave Matching & Dispatching
- **Spatial Indexing**: Leverages PostgreSQL `GiST` spatial indexing on PostGIS/geography columns for high-efficiency proximity queries.
- **Multi-Helper Dispatch**: Supports single-helper and multi-helper crew matching with dynamic radius expansion and wave notifications.

### 2. 🔐 Production Security & Access Control
- **Strict Row Level Security (RLS)**: Enforced across all PostgreSQL tables (`profiles`, `jobs`, `job_offers`, `user_locations`, `help_reports`).
- **PKCE Authentication**: Mobile-friendly PKCE flow using Supabase Auth.
- **Zero-Hardcoded Backend Secrets**: Backend secrets (Service Role Keys, VAPID Private Keys) are stored in Deno Environment Variables and Supabase Secret Store.

### 3. 📲 PWA & Native Web Push Experience
- **Service Worker Caching**: Offline app shell caching with instant load performance.
- **Push Notifications**: Native-like background notification handler for job offers, acceptances, and completion OTPs.

---

## 📁 Repository Structure

```text
HelpHive/
├── .github/
│   └── workflows/ci.yml         # Automated CI/CD pipeline (Lint, Build, Preview)
├── public/                       # Static PWA icons, webmanifest, and public assets
├── src/
│   ├── components/               # Reusable UI components (MapView, JobCard, Modals, etc.)
│   ├── config/                   # Constants, marketplace rules, and Supabase client
│   ├── hooks/                    # Custom React hooks (useProfileCompletion, etc.)
│   ├── screens/                  # Application screens (Poster & Tasker flows, Admin Dashboard)
│   │   ├── poster/               # Poster-specific screens (PostJob, LiveStatus, Rating)
│   │   └── tasker/               # Tasker-specific screens (TaskerHome, JobDetails, Onboarding)
│   ├── services/                 # Abstraction layer for API calls and RPCs
│   ├── store/                    # AppContext, NotificationContext, ToastContext
│   ├── utils/                    # Event tracker, geocoding, location helpers
│   ├── App.jsx                   # Primary router and app layout
│   └── sw.js                     # PWA Service Worker push notification handler
├── supabase/
│   ├── functions/                # Deno Edge Functions (push-notification)
│   └── migrations/               # Production SQL schema migrations & RLS policies
├── eslint.config.js              # Modern ESLint v10 flat config
├── index.html                    # PWA metadata and entry HTML
├── pwa-assets.config.js          # PWA icon generator configuration
├── README.md                     # Project documentation
└── vite.config.js                # Vite build configuration with PWA plugin
```

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 20.x or later
- npm v10 or later

### 1. Installation
```bash
git clone https://github.com/hemanth17r/HelpHive.git
cd HelpHive
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OLA_MAPS_API_KEY=your_ola_maps_key
```

### 3. Start Development Server
```bash
npm run dev
```
The application will launch at `http://localhost:5173`.

---

## 🧪 Testing & Code Quality

- **Production Build Check**: `npm run build`
- **Linting & Code Formatting**: `npm run lint`

---

## 📜 License & Ownership
Copyright © 2026 HelpHive. All rights reserved.
