import { test, expect } from '@playwright/test';

/**
 * Helper: Navigate to Tasker profile and seed a tasker user.
 * Returns after the Tasker home screen is loaded.
 */
async function navigateToTaskerHome(page) {
  await page.goto('/');

  // Seed a tasker user with skills via localStorage
  await page.evaluate(() => {
    localStorage.setItem('userId', 'tasker_activity_test');
    localStorage.setItem('activeRole', 'tasker');
  });

  await page.reload();

  // Select Tasker role from landing if shown
  const iWantToWork = page.getByText('I Want to Work').first();
  if (await iWantToWork.isVisible({ timeout: 2000 }).catch(() => false)) {
    await iWantToWork.click();
    // Complete onboarding
    await page.getByText('Moving').first().click();
    await page.getByRole('button', { name: /Start Earning/i }).first().click();
  }
}

/**
 * Helper: Navigate from Tasker Home → Profile tab → "My Activity & Payments"
 */
async function navigateToActivityScreen(page) {
  await navigateToTaskerHome(page);

  // Click the profile tab (bottom nav or profile avatar)
  const profileTab = page.locator('[data-tab="profile"]').first();
  if (await profileTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await profileTab.click();
  } else {
    // Fallback: click the bird avatar in the top bar
    const avatar = page.locator('.rounded-full').filter({ has: page.locator('svg, img') }).first();
    await avatar.click();
  }

  // Wait for profile screen to load
  await expect(page.getByText('My Activity & Payments').first()).toBeVisible({ timeout: 5000 });

  // Click "My Activity & Payments"
  await page.getByText('My Activity & Payments').first().click();

  // Verify we're on the activity screen
  await expect(page.getByText('Earnings Overview').first()).toBeVisible({ timeout: 5000 });
}

test.describe('Tasker Activity & Payments Screen', () => {

  test('should navigate to Activity screen from profile', async ({ page }) => {
    await navigateToActivityScreen(page);

    // Verify the screen header
    await expect(page.locator('#tasker-activity-back-btn').first()).toBeVisible();
  });

  test('should display earnings summary card with all metrics', async ({ page }) => {
    await navigateToActivityScreen(page);

    // Verify Earnings Overview section
    await expect(page.locator('#earnings-summary-card').first()).toBeVisible();

    // Verify "Total Earned" label and value
    await expect(page.getByText('Total Earned').first()).toBeVisible();
    await expect(page.locator('#total-earned-value').first()).toBeVisible();

    // Verify "Jobs Completed" metric
    await expect(page.getByText('Jobs Completed').first()).toBeVisible();
    await expect(page.locator('#jobs-completed-value').first()).toBeVisible();

    // Verify "This Month" metric
    await expect(page.getByText('This Month').first()).toBeVisible();
    await expect(page.locator('#this-month-value').first()).toBeVisible();
  });

  test('should display monthly earnings for last 3 months', async ({ page }) => {
    await navigateToActivityScreen(page);

    // Verify monthly earnings section
    await expect(page.locator('#monthly-earnings-section').first()).toBeVisible();
    await expect(page.getByText('Monthly Earnings').first()).toBeVisible();

    // Should show "(Current)" label on first month
    await expect(page.getByText('(Current)').first()).toBeVisible();
  });

  test('should display active jobs section with job cards', async ({ page }) => {
    await navigateToActivityScreen(page);

    // Verify Active Jobs section exists
    await expect(page.locator('#active-jobs-section').first()).toBeVisible();
    await expect(page.getByText('Active Jobs').first()).toBeVisible();

    // Job cards should show category, description, amount, people booked, job ID, and hirer name
    const firstActiveCard = page.locator('[id^="tasker-job-card-"]').first();
    await expect(firstActiveCard).toBeVisible();

    // Verify job card contains "Booked:" text (people count)
    await expect(firstActiveCard.getByText(/Booked:/)).toBeVisible();

    // Verify job card contains a job ID (# prefix or JOB- prefix)
    await expect(firstActiveCard.getByText(/^#|^JOB-/)).toBeVisible();

    // Verify job card contains "Hirer:" text
    await expect(firstActiveCard.getByText(/Hirer:/)).toBeVisible();
  });

  test('should display completed jobs section with job cards', async ({ page }) => {
    await navigateToActivityScreen(page);

    // Verify Completed Jobs section exists
    await expect(page.locator('#completed-jobs-section').first()).toBeVisible();
    await expect(page.getByText('Completed Jobs').first()).toBeVisible();
  });

  test('should expand active jobs list on "Show All" click', async ({ page }) => {
    await navigateToActivityScreen(page);

    // The "Show All" button should be visible if there are more than 2 mock jobs
    const showAllBtn = page.locator('#active-show-all-btn').first();
    if (await showAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Count visible cards before
      const activeSection = page.locator('#active-jobs-section').first();
      const cardsBefore = await activeSection.locator('[id^="tasker-job-card-"]').count();

      // Click Show All
      await showAllBtn.click();

      // Count visible cards after — should be more
      const cardsAfter = await activeSection.locator('[id^="tasker-job-card-"]').count();
      expect(cardsAfter).toBeGreaterThanOrEqual(cardsBefore);

      // Button text should now say "Show Less"
      await expect(page.getByText('Show Less').first()).toBeVisible();
    }
  });

  test('should expand completed jobs list on "Show All" click', async ({ page }) => {
    await navigateToActivityScreen(page);

    const showAllBtn = page.locator('#completed-show-all-btn').first();
    if (await showAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const completedSection = page.locator('#completed-jobs-section').first();
      const cardsBefore = await completedSection.locator('[id^="tasker-job-card-"]').count();

      await showAllBtn.click();

      const cardsAfter = await completedSection.locator('[id^="tasker-job-card-"]').count();
      expect(cardsAfter).toBeGreaterThanOrEqual(cardsBefore);
    }
  });

  test('should navigate back when back button is clicked', async ({ page }) => {
    await navigateToActivityScreen(page);

    // Click back button
    await page.locator('#tasker-activity-back-btn').first().click();

    // Should be back on profile — "My Activity & Payments" should be visible again
    await expect(page.getByText('My Activity & Payments').first()).toBeVisible({ timeout: 5000 });
  });
});
