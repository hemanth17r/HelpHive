# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tasker\2-browse-and-accept-job.spec.js >> Tasker Flow - Browse & Accept Job >> should browse available jobs and accept one
- Location: tests\e2e\tasker\2-browse-and-accept-job.spec.js:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Jobs Matching Your Skills').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Jobs Matching Your Skills').first()

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
  3  | test.describe('Tasker Flow - Browse & Accept Job', () => {
  4  |   test('should browse available jobs and accept one', async ({ page }) => {
  5  |     // Navigate to landing page
  6  |     await page.goto('/');
  7  | 
  8  |     // Seed mock data
  9  |     await page.evaluate(() => {
  10 |       localStorage.setItem('mock_profiles', JSON.stringify([{
  11 |         id: 'tasker_test_1',
  12 |         role: 'tasker',
  13 |         name: 'Tasker Test',
  14 |         phone: '9988776655',
  15 |         skills: ['moving']
  16 |       }]));
  17 |       
  18 |       localStorage.setItem('mock_jobs', JSON.stringify([{
  19 |         id: 'job_test_1',
  20 |         poster_id: 'poster_test_1',
  21 |         skill_id: 'moving',
  22 |         description: 'Need help moving boxes',
  23 |         amount: 500,
  24 |         status: 'open',
  25 |         created_at: new Date().toISOString()
  26 |       }]));
  27 |       
  28 |       localStorage.setItem('userId', 'tasker_test_1');
  29 |       localStorage.setItem('activeRole', 'tasker');
  30 |     });
  31 | 
  32 |     // Reload to apply state and enter Tasker Home Screen
  33 |     await page.reload();
  34 | 
  35 |     // Verify Tasker Home
> 36 |     await expect(page.getByText('Jobs Matching Your Skills').first()).toBeVisible();
     |                                                                       ^ Error: expect(locator).toBeVisible() failed
  37 |     await expect(page.getByText('Need help moving boxes').first()).toBeVisible();
  38 | 
  39 |     // Click Accept on the Job Card
  40 |     await page.getByRole('button', { name: 'Accept' }).first().click();
  41 | 
  42 |     // Verify transition to Job Details Screen (Job in Progress)
  43 |     await expect(page.getByText('Job in Progress').first()).toBeVisible();
  44 |     await expect(page.getByText('Verify OTP to Start Job').first()).toBeVisible();
  45 | 
  46 |     // Enter OTP (fallback is 1234)
  47 |     await page.getByPlaceholder('Enter OTP').first().fill('1234');
  48 |     await page.getByRole('button', { name: 'Verify' }).first().click();
  49 | 
  50 |     // Verify OTP Verified! text
  51 |     await expect(page.getByText('OTP Verified!').first()).toBeVisible();
  52 | 
  53 |     // Complete Task
  54 |     await page.getByRole('button', { name: 'Mark Task Complete' }).first().click();
  55 | 
  56 |     // Verify transition to Rating Screen
  57 |     await expect(page.getByText('Rate the Hirer').first()).toBeVisible();
  58 | 
  59 |     // Leave a rating
  60 |     const stars = page.locator('.lucide-star');
  61 |     if (await stars.count() >= 5) {
  62 |       await stars.nth(4).click();
  63 |     }
  64 |     await page.getByRole('button', { name: 'Submit Review' }).first().click();
  65 | 
  66 |     // Verify Thank You! success text
  67 |     await expect(page.getByText('Thank You!').first()).toBeVisible();
  68 |   });
  69 | });
  70 | 
```