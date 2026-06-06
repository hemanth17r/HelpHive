import { test, expect } from '@playwright/test';

test.describe('Tasker (Helper) Flow - Landing & Onboarding', () => {
  test('should load landing page, create profile, and complete onboarding', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/');

    // Ensure page loaded
    await expect(page.getByText('Hyperlocal helpers at your doorstep').first()).toBeVisible();

    // Select Tasker Role
    await page.getByText('I Want to Work').first().click();

    // Verify transition to Onboarding Screen
    await expect(page.getByText('What Can You Do?').first()).toBeVisible();

    // Select a skill
    await page.getByText('Moving').first().click();

    // Click Start Earning
    await page.getByRole('button', { name: /Start Earning/i }).first().click();

    // Verify transition to Tasker Home Screen
    await expect(page.getByText('No Tasks Nearby').first()).toBeVisible();
  });
});
