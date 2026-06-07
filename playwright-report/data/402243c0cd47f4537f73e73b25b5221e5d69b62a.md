# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tasker\1-landing-and-onboarding.spec.js >> Tasker (Helper) Flow - Landing & Onboarding >> should load landing page, create profile, and complete onboarding
- Location: tests\e2e\tasker\1-landing-and-onboarding.spec.js:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Hyperlocal helpers at your doorstep').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Hyperlocal helpers at your doorstep').first()

```

```yaml
- main:
  - heading "HelpHive" [level=1]
  - paragraph: Get trusted local help, fast.
  - button "I Need Help Post a task and connect with nearby helpers.":
    - heading "I Need Help" [level=2]
    - paragraph: Post a task and connect with nearby helpers.
  - button "I Want to Work Find local tasks and start earning.":
    - heading "I Want to Work" [level=2]
    - paragraph: Find local tasks and start earning.
  - button "Already have an account? Log In"
  - text: Connect • Help • Earn
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Tasker (Helper) Flow - Landing & Onboarding', () => {
  4  |   test('should load landing page, create profile, and complete onboarding', async ({ page }) => {
  5  |     // Navigate to landing page
  6  |     await page.goto('/');
  7  | 
  8  |     // Ensure page loaded
> 9  |     await expect(page.getByText('Hyperlocal helpers at your doorstep').first()).toBeVisible();
     |                                                                                 ^ Error: expect(locator).toBeVisible() failed
  10 | 
  11 |     // Select Tasker Role
  12 |     await page.getByText('I Want to Work').first().click();
  13 | 
  14 |     // Verify transition to Onboarding Screen
  15 |     await expect(page.getByText('What Can You Do?').first()).toBeVisible();
  16 | 
  17 |     // Select a skill
  18 |     await page.getByText('Moving').first().click();
  19 | 
  20 |     // Click Start Earning
  21 |     await page.getByRole('button', { name: /Start Earning/i }).first().click();
  22 | 
  23 |     // Verify transition to Tasker Home Screen
  24 |     await expect(page.getByText('No Tasks Nearby').first()).toBeVisible();
  25 |   });
  26 | });
  27 | 
```