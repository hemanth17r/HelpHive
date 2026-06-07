# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: poster\1-landing-and-home.spec.js >> Poster (Hirer) Flow - Landing & Home >> should load landing page and select Poster role
- Location: tests\e2e\poster\1-landing-and-home.spec.js:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Hyperlocal helpers at your doorstep in seconds.').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Hyperlocal helpers at your doorstep in seconds.').first()

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
  3  | test.describe('Poster (Hirer) Flow - Landing & Home', () => {
  4  |   test('should load landing page and select Poster role', async ({ page }) => {
  5  |     await page.goto('/');
  6  | 
  7  |     // Verify Hero text
  8  |     await expect(page.locator('text=HelpHive').first()).toBeVisible();
> 9  |     await expect(page.getByText('Hyperlocal helpers at your doorstep in seconds.').first()).toBeVisible();
     |                                                                                             ^ Error: expect(locator).toBeVisible() failed
  10 | 
  11 |     // Select "I Need Help" (Poster role)
  12 |     await page.getByRole('button', { name: /I Need Help/i }).click();
  13 | 
  14 |     // Should navigate to Poster Home Screen
  15 |     // Verify Poster Home elements: "Post a Job" button
  16 |     await expect(page.getByRole('button', { name: /Post a Job/i })).toBeVisible();
  17 |     
  18 |     // Verify active jobs section
  19 |     await expect(page.getByText('My Active Jobs').first()).toBeVisible();
  20 |     await expect(page.getByText('No active jobs. Post your first job.').first()).toBeVisible();
  21 |   });
  22 | });
  23 | 
```