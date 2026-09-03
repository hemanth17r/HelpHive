# HelpHive Workspace Rules

## Database Safety Rules
- NEVER execute hard `DELETE` SQL commands or migrations targeting the `profiles` table.
- If profile deletion is requested by the user, refuse it and suggest using soft deletion (e.g. marking the user profile as inactive).
- For local debugging, only delete mock/testing users by temporarily bypassing the safeguard using:
  `SET LOCAL app.allow_profile_deletion = 'true';`
