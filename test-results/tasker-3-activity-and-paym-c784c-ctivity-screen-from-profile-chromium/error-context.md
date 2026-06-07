# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tasker\3-activity-and-payments.spec.js >> Tasker Activity & Payments Screen >> should navigate to Activity screen from profile
- Location: tests\e2e\tasker\3-activity-and-payments.spec.js:56:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('My Activity & Payments').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('My Activity & Payments').first()

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
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Helper: Navigate to Tasker profile and seed a tasker user.
  5   |  * Returns after the Tasker home screen is loaded.
  6   |  */
  7   | async function navigateToTaskerHome(page) {
  8   |   await page.goto('/');
  9   | 
  10  |   // Seed a tasker user with skills via localStorage
  11  |   await page.evaluate(() => {
  12  |     localStorage.setItem('userId', 'tasker_activity_test');
  13  |     localStorage.setItem('activeRole', 'tasker');
  14  |   });
  15  | 
  16  |   await page.reload();
  17  | 
  18  |   // Select Tasker role from landing if shown
  19  |   const iWantToWork = page.getByText('I Want to Work').first();
  20  |   if (await iWantToWork.isVisible({ timeout: 2000 }).catch(() => false)) {
  21  |     await iWantToWork.click();
  22  |     // Complete onboarding
  23  |     await page.getByText('Moving').first().click();
  24  |     await page.getByRole('button', { name: /Start Earning/i }).first().click();
  25  |   }
  26  | }
  27  | 
  28  | /**
  29  |  * Helper: Navigate from Tasker Home → Profile tab → "My Activity & Payments"
  30  |  */
  31  | async function navigateToActivityScreen(page) {
  32  |   await navigateToTaskerHome(page);
  33  | 
  34  |   // Click the profile tab (bottom nav or profile avatar)
  35  |   const profileTab = page.locator('[data-tab="profile"]').first();
  36  |   if (await profileTab.isVisible({ timeout: 2000 }).catch(() => false)) {
  37  |     await profileTab.click();
  38  |   } else {
  39  |     // Fallback: click the bird avatar in the top bar
  40  |     const avatar = page.locator('.rounded-full').filter({ has: page.locator('svg, img') }).first();
  41  |     await avatar.click();
  42  |   }
  43  | 
  44  |   // Wait for profile screen to load
> 45  |   await expect(page.getByText('My Activity & Payments').first()).toBeVisible({ timeout: 5000 });
      |                                                                  ^ Error: expect(locator).toBeVisible() failed
  46  | 
  47  |   // Click "My Activity & Payments"
  48  |   await page.getByText('My Activity & Payments').first().click();
  49  | 
  50  |   // Verify we're on the activity screen
  51  |   await expect(page.getByText('Earnings Overview').first()).toBeVisible({ timeout: 5000 });
  52  | }
  53  | 
  54  | test.describe('Tasker Activity & Payments Screen', () => {
  55  | 
  56  |   test('should navigate to Activity screen from profile', async ({ page }) => {
  57  |     await navigateToActivityScreen(page);
  58  | 
  59  |     // Verify the screen header
  60  |     await expect(page.locator('#tasker-activity-back-btn').first()).toBeVisible();
  61  |   });
  62  | 
  63  |   test('should display earnings summary card with all metrics', async ({ page }) => {
  64  |     await navigateToActivityScreen(page);
  65  | 
  66  |     // Verify Earnings Overview section
  67  |     await expect(page.locator('#earnings-summary-card').first()).toBeVisible();
  68  | 
  69  |     // Verify "Total Earned" label and value
  70  |     await expect(page.getByText('Total Earned').first()).toBeVisible();
  71  |     await expect(page.locator('#total-earned-value').first()).toBeVisible();
  72  | 
  73  |     // Verify "Jobs Completed" metric
  74  |     await expect(page.getByText('Jobs Completed').first()).toBeVisible();
  75  |     await expect(page.locator('#jobs-completed-value').first()).toBeVisible();
  76  | 
  77  |     // Verify "This Month" metric
  78  |     await expect(page.getByText('This Month').first()).toBeVisible();
  79  |     await expect(page.locator('#this-month-value').first()).toBeVisible();
  80  |   });
  81  | 
  82  |   test('should display monthly earnings for last 3 months', async ({ page }) => {
  83  |     await navigateToActivityScreen(page);
  84  | 
  85  |     // Verify monthly earnings section
  86  |     await expect(page.locator('#monthly-earnings-section').first()).toBeVisible();
  87  |     await expect(page.getByText('Monthly Earnings').first()).toBeVisible();
  88  | 
  89  |     // Should show "(Current)" label on first month
  90  |     await expect(page.getByText('(Current)').first()).toBeVisible();
  91  |   });
  92  | 
  93  |   test('should display active jobs section with job cards', async ({ page }) => {
  94  |     await navigateToActivityScreen(page);
  95  | 
  96  |     // Verify Active Jobs section exists
  97  |     await expect(page.locator('#active-jobs-section').first()).toBeVisible();
  98  |     await expect(page.getByText('Active Jobs').first()).toBeVisible();
  99  | 
  100 |     // Job cards should show category, description, amount, people booked, job ID, and hirer name
  101 |     const firstActiveCard = page.locator('[id^="tasker-job-card-"]').first();
  102 |     await expect(firstActiveCard).toBeVisible();
  103 | 
  104 |     // Verify job card contains "Booked:" text (people count)
  105 |     await expect(firstActiveCard.getByText(/Booked:/)).toBeVisible();
  106 | 
  107 |     // Verify job card contains a job ID (# prefix or JOB- prefix)
  108 |     await expect(firstActiveCard.getByText(/^#|^JOB-/)).toBeVisible();
  109 | 
  110 |     // Verify job card contains "Hirer:" text
  111 |     await expect(firstActiveCard.getByText(/Hirer:/)).toBeVisible();
  112 |   });
  113 | 
  114 |   test('should display completed jobs section with job cards', async ({ page }) => {
  115 |     await navigateToActivityScreen(page);
  116 | 
  117 |     // Verify Completed Jobs section exists
  118 |     await expect(page.locator('#completed-jobs-section').first()).toBeVisible();
  119 |     await expect(page.getByText('Completed Jobs').first()).toBeVisible();
  120 |   });
  121 | 
  122 |   test('should expand active jobs list on "Show All" click', async ({ page }) => {
  123 |     await navigateToActivityScreen(page);
  124 | 
  125 |     // The "Show All" button should be visible if there are more than 2 mock jobs
  126 |     const showAllBtn = page.locator('#active-show-all-btn').first();
  127 |     if (await showAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  128 |       // Count visible cards before
  129 |       const activeSection = page.locator('#active-jobs-section').first();
  130 |       const cardsBefore = await activeSection.locator('[id^="tasker-job-card-"]').count();
  131 | 
  132 |       // Click Show All
  133 |       await showAllBtn.click();
  134 | 
  135 |       // Count visible cards after — should be more
  136 |       const cardsAfter = await activeSection.locator('[id^="tasker-job-card-"]').count();
  137 |       expect(cardsAfter).toBeGreaterThanOrEqual(cardsBefore);
  138 | 
  139 |       // Button text should now say "Show Less"
  140 |       await expect(page.getByText('Show Less').first()).toBeVisible();
  141 |     }
  142 |   });
  143 | 
  144 |   test('should expand completed jobs list on "Show All" click', async ({ page }) => {
  145 |     await navigateToActivityScreen(page);
```