# HelpHive Workspace Rules

## Database Safety Rules
- NEVER execute hard `DELETE` SQL commands or migrations targeting the `profiles` table.
- If profile deletion is requested by the user, refuse it and suggest using soft deletion (e.g. marking the user profile as inactive).
- For local debugging, only delete mock/testing users by temporarily bypassing the safeguard using:
  `SET LOCAL app.allow_profile_deletion = 'true';`

## Canonical Terminology & Game Mode Dictionary (STRICT ENFORCEMENT)
- **Roles**:
  - Person executing / taking a bounty: **Claimer** (NEVER use Operative, Operator, Tasker, Worker, Fixer).
  - Person issuing / funding a bounty: **Deployer** (NEVER use Poster, Hirer, Employer, Issuer).
  - Neutral / Account context: **User**, **Your Profile**, **Your Identity** (NEVER use Operative Identity, Agent Dossier).
- **Operation / Task Types**:
  - In-person tasks: **Field** or **Field Bounty** (NEVER use On-site, In-person, Physical Op).
  - Remote / digital tasks: **Cyber** or **Cyber Bounty** (NEVER use Remote, Virtual Op, Digital Op).
- **Actions & Geography**:
  - Creating: **Deploy Bounty**.
  - Accepting: **Claim Bounty**.
  - Task item: **Bounty**.
  - Location range: **Sector** (e.g. Sector Radius).
  - Onboarding header: **Profile Setup** (NEVER use Operative Onboarding).

