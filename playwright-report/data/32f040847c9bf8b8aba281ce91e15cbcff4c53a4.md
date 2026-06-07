# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: poster\2-post-job-flow.spec.js >> Poster (Hirer) Flow - Job Posting >> should complete the job posting flow
- Location: tests\e2e\poster\2-post-job-flow.spec.js:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('What kind of help do you need?').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('What kind of help do you need?').first()

```

```yaml
- banner:
  - text: LPU & nearby HelpHive
  - paragraph: Guest
  - paragraph: Hirer
  - img
- main:
  - button "Post a Job Get local helpers in seconds":
    - heading "Post a Job" [level=2]
    - paragraph: Get local helpers in seconds
  - text: My Active Jobs Moving Searching for Helpers...
  - button
  - paragraph: Test job description
  - text: "Needed: 1 ₹100 Drafts"
  - paragraph: No drafts.
  - button "Home"
  - button "Profile"
  - button "Switch to Tasker"
- heading "Complete Profile" [level=2]
- paragraph: Required to continue
- button
- text: Name
- textbox "e.g. John Doe"
- text: Phone Number
- textbox "e.g. 987-654-3210": 987-654-3210
- paragraph: Name is required.
- button "Save & Continue"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Poster (Hirer) Flow - Job Posting', () => {
  4  |   test('should complete the job posting flow', async ({ page }) => {
  5  |     await page.goto('/');
  6  | 
  7  |     // Select "I Need Help" (Poster role)
  8  |     await page.getByRole('button', { name: /I Need Help/i }).click();
  9  | 
  10 |     // Click "Post a Job"
  11 |     await page.getByRole('button', { name: /Post a Job/i }).first().click();
  12 | 
  13 |     // A profile completion modal will appear since we are using mock data and have no profile yet
  14 |     const phoneInput = page.getByPlaceholder('e.g. 987-654-3210');
  15 |     await expect(phoneInput).toBeVisible();
  16 |     await phoneInput.fill('9876543210');
  17 |     await page.getByRole('button', { name: 'Save & Continue' }).click();
  18 | 
  19 |     // Now on PostJobScreen
> 20 |     await expect(page.getByText('What kind of help do you need?').first()).toBeVisible();
     |                                                                            ^ Error: expect(locator).toBeVisible() failed
  21 | 
  22 |     // Select category (e.g., Moving)
  23 |     await page.getByText('Moving').first().click();
  24 | 
  25 |     // Enter task description
  26 |     await page.getByPlaceholder('e.g. Need 2 people to move boxes from 3rd floor to ground floor.').first().fill('Test task: Need help moving a large sofa from 1st floor to 3rd floor.');
  27 | 
  28 |     // Enter amount (test minimum validation)
  29 |     await page.getByPlaceholder('Amount').first().fill('5');
  30 |     // Validate that the job isn't submitted (button is disabled)
  31 |     await expect(page.getByRole('button', { name: 'Post Job Now' }).first()).toBeDisabled();
  32 |     await page.getByPlaceholder('Amount').first().fill('50');
  33 | 
  34 |     // Click Post Job
  35 |     await page.getByRole('button', { name: 'Post Job Now' }).first().click();
  36 | 
  37 |     // Should navigate to LiveStatusScreen
  38 |     await expect(page.getByText('Searching for Helpers...').first()).toBeVisible();
  39 | 
  40 |     // The mock data system simulates tasker acceptance after 6 seconds
  41 |     await page.waitForTimeout(7000);
  42 | 
  43 |     // Should navigate to CrewConfirmedScreen
  44 |     await expect(page.getByText('Crew Confirmed', { exact: true }).first()).toBeVisible();
  45 |     await expect(page.getByText('Your Crew is Set!').first()).toBeVisible();
  46 | 
  47 |     // Complete the task
  48 |     await page.getByText('Pay Offline').first().click();
  49 |     await page.getByRole('button', { name: /I Have Paid/i }).first().click();
  50 |     await page.getByRole('button', { name: 'Complete Task' }).first().click();
  51 | 
  52 |     // Rating Screen
  53 |     await expect(page.getByText('How was your experience?').first()).toBeVisible();
  54 |     // Click 5th star
  55 |     const stars = page.locator('.lucide-star');
  56 |     if (await stars.count() >= 5) {
  57 |       await stars.nth(4).click();
  58 |     }
  59 |     await page.getByRole('button', { name: 'Submit Feedback' }).first().click();
  60 | 
  61 |     // Job Receipt Screen
  62 |     await expect(page.getByText('Job Completed').first()).toBeVisible();
  63 |     await page.goto('/');
  64 | 
  65 |     // Verify job is now in active or completed
  66 |     await expect(page.getByText('My Active Jobs').first()).toBeVisible();
  67 |   });
  68 | });
  69 | 
```