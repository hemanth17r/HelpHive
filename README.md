# HelpHive

HelpHive is a platform connecting users (Posters) who need help with everyday tasks with individuals (Taskers) willing to complete those tasks.

---

### 🇮🇳 Version 2: Pan India Launch Upgrade

HelpHive has been upgraded to **Version 2** with major architectural enhancements for scaling, location-aware dispatcher queues, secure waitlists, and PWA push notifications.

For detailed architecture, databases, and setups, see [PAN_INDIA_LAUNCH_V2.md](file:///c:/Users/AKKALA%20HEMANTH%20REDDY/OneDrive/Desktop/HelpHive/PAN_INDIA_LAUNCH_V2.md).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20.x or later
- npm (comes with Node.js)
- A Supabase Project

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/hemanth17r/HelpHive.git
cd HelpHive
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the root directory based on `.env.example`:

```bash
cp .env.example .env.local
```

Fill in the required environment variables in `.env.local`:

```
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Start Development Server

Run the local development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 🛠 Project Structure & Branching Strategy

This project follows a standard Git workflow:

- `main`: The stable production branch. Code merged here is automatically deployed to production.
- Feature branches (`feature/your-feature-name`): Used for developing new features.
- Pull Requests (PRs): PRs created against `main` automatically trigger CI checks (linting, building) and deploy a Preview Environment to Firebase Hosting.

---

## 🚀 Deployment Process

We use GitHub Actions for continuous integration and continuous deployment (CI/CD) to Firebase Hosting.

### Preview Deployments
When you create a Pull Request to `main`, GitHub Actions will:
1. Lint the code.
2. Build the application.
3. Deploy a temporary "Preview" channel on Firebase Hosting.
4. Add a comment to the PR with the preview URL.

### Production Deployments
When code is merged into the `main` branch, GitHub Actions will:
1. Build the application.
2. Deploy directly to the `live` channel on Firebase Hosting.

**Note:** For deployments to succeed, the GitHub repository must have the following secrets configured:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `FIREBASE_SERVICE_ACCOUNT_VYRNO_52018`

---

## 🛡 Troubleshooting & Maintenance

- **Build Failures:** Ensure your `.env.local` is correct and that you have no TypeScript/ESLint errors (`npm run lint`).
- **Production Rollbacks:** If a bad deployment occurs, you can rollback via the Firebase Console (Hosting > View Release History > Rollback) or by reverting the commit on the `main` branch.
- **Preview Channel Cleanup:** Preview channels automatically expire. You do not need to delete them manually.
