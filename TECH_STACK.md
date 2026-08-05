# HelpHive 🐝 Tech Stack & Architectural Specification

> **Version**: 1.0  
> **Last Updated**: July 2026  
> **Platform**: Hyperlocal Micro-Task Marketplace & On-Demand Service Dispatch Platform  

---

## 📌 Executive Overview

HelpHive is a production-grade, real-time Progressive Web Application (PWA) designed to seamlessly connect individuals needing everyday assistance (**Posters**) with verified nearby helpers (**Taskers**). 

The platform is engineered for:
- **Sub-second hyperlocal wave matching** using PostGIS spatial indexing.
- **High-concurrency event broadcasting** via PostgreSQL Change Broadcasts & RPC Dispatch Queues.
- **Zero-Trust Security** with fine-grained Row Level Security (RLS) and mobile-friendly PKCE authentication.
- **Offline-First PWA Capabilities** powered by Service Worker caching and native W3C Web Push notifications.

---

## 🛠 Tech Stack Layer Breakdown

### 1. Frontend & Client Layer
* **UI Framework**: [React 19](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/package.json#L19) (`react`, `react-dom`) — Declarative, component-driven UI architecture with modern hooks.
* **Build Tooling & Dev Server**: [Vite 8](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/package.json#L37) (`vite`, `@vitejs/plugin-react`) — Instant HMR and optimized production bundle compilation.
* **Styling & Design Tokens**: [TailwindCSS v4](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/package.json#L36) (`tailwindcss`, `@tailwindcss/vite`) — Utility-first styling engine with customized token system.
* **Iconography**: [Lucide React](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/package.json#L18) — Clean, scalable vector icons.
* **State Management**: React Context API (`AppContext`, `NotificationContext`, `ToastContext`) for modular global state handling.
* **Maps & Geolocation**: **Ola Maps API** for interactive map rendering, route calculation, and reverse geocoding alongside browser HTML5 Geolocation API.

### 2. Backend & Data Layer (BaaS)
* **Backend Platform**: **Supabase** — Full enterprise backend-as-a-service ecosystem.
* **Database Engine**: **PostgreSQL** — Relational storage with custom triggers and stored procedures (RPCs).
* **Spatial Indexing**: **GiST Spatial Indexing** on PostGIS/geography columns for high-efficiency proximity queries during wave dispatch.
* **Access Control**: **Row Level Security (RLS)** — Granular table policies enforced across `profiles`, `jobs`, `job_offers`, `user_locations`, and `help_reports`.
* **Authentication**: **Supabase Auth** with PKCE flow for mobile web compatibility.
* **Realtime Broadcasts**: Supabase Realtime for instant status updates, active job tracking, and dispatch event queues.

### 3. PWA & Serverless Edge Layer
* **PWA Engine**: [Vite Plugin PWA](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/package.json#L38) (`vite-plugin-pwa`) with `@vite-pwa/assets-generator` for manifest generation and PWA asset optimization.
* **Service Worker**: Custom `sw.js` implementing app-shell offline caching and background push event handlers.
* **Serverless Edge Computing**: **Supabase Edge Functions** (built on Deno runtime, e.g., `push-notification`).
* **Push Notifications**: **W3C Web Push API** using VAPID key pairs for native background notifications (job offers, acceptances, OTPs).

### 4. Testing, Quality & DevOps
* **E2E Automation**: [Playwright](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/package.json#L35) (`playwright`) — Multi-role, end-to-end user workflow automated testing.
* **Static Code Analysis**: [ESLint v10](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/package.json#L29) flat config (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`).
* **Git Hooks & Staging**: [Husky v9](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/package.json#L33) & `lint-staged` for mandatory pre-commit code verification.
* **CI/CD Pipeline**: GitHub Actions (`.github/workflows/ci.yml`) for automated linting, building, and preview validation.
* **Production Hosting**: Vercel Edge Network.

---

## 📦 Key Package Dependencies

| Package | Version | Type | Function / Usage |
| :--- | :---: | :---: | :--- |
| `react` / `react-dom` | `^19.2.6` | Dependency | UI Framework & DOM Rendering Engine |
| `@supabase/supabase-js` | `^2.106.2` | Dependency | Supabase Client SDK (DB, Auth, Realtime, RPC) |
| `lucide-react` | `^1.16.0` | Dependency | UI Iconography System |
| `vite` | `^8.0.12` | DevDependency | Dev Server & Bundler |
| `tailwindcss` | `^4.3.0` | DevDependency | CSS Engine |
| `vite-plugin-pwa` | `^1.3.0` | DevDependency | Service Worker & Web Manifest Builder |
| `playwright` | `^1.61.1` | DevDependency | End-to-End Automated Testing Framework |
| `eslint` | `^10.3.0` | DevDependency | Code Hygiene & Linter |

---

## 📂 Repository Structure Map

```text
HelpHive/
├── .github/
│   └── workflows/ci.yml         # Automated CI/CD Pipeline (Lint, Build, Preview)
├── public/                       # Web manifest, icons & public PWA assets
├── src/
│   ├── components/               # Reusable UI components (MapView, JobCard, Modals)
│   ├── config/                   # Supabase client, environment constants & rules
│   ├── hooks/                    # Custom React hooks (useProfileCompletion, etc.)
│   ├── screens/                  # App screens for Poster & Tasker flows
│   │   ├── poster/               # Job creation, live tracking, ratings
│   │   └── tasker/               # Tasker dispatch feed, job details, onboarding
│   ├── services/                 # Supabase RPC & API abstraction layers
│   ├── store/                    # AppContext, NotificationContext, ToastContext
│   ├── utils/                    # Geocoding, location helpers, analytics
│   ├── App.jsx                   # Primary Router & Root Layout
│   └── sw.js                     # PWA Service Worker (Push Handler)
├── supabase/
│   ├── functions/                # Deno Edge Functions (push-notification)
│   └── migrations/               # PostgreSQL schema migrations & RLS policies
├── eslint.config.js              # Modern ESLint v10 Flat Config
├── pwa-assets.config.js          # PWA Icon Generator Config
├── README.md                     # Project Overview
└── vite.config.js                # Vite Build & PWA Configuration
```

---

## 🔒 Security & Architecture Standards

1. **Zero Hardcoded Secrets**: All private backend keys (Service Role Keys, VAPID Private Keys) reside exclusively in Deno Environment Variables and Supabase Secret Manager.
2. **Row Level Security (RLS)**: Enforced strictly at the database level to ensure users can only access authorized records.
3. **Database Safeguards**: Deletion safety rules to prevent unauthorized hard deletion of profile records.
