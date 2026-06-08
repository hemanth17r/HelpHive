import { test, expect } from '@playwright/test';

test.describe('Poster (Hirer) Flow - Job Posting', () => {
  test('should complete the job posting flow', async ({ page }) => {
    await page.goto('/');

    // Select "I Need Help" (Poster role)
    await page.getByRole('button', { name: /I Need Help/i }).click();

    // Click "Post a Job"
    await page.getByRole('button', { name: /Post a Job/i }).first().click();

    // A profile completion modal will appear since we are using mock data and have no profile yet
    const phoneInput = page.getByPlaceholder('e.g. 987-654-3210');
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('9876543210');
    await page.getByRole('button', { name: 'Save & Continue' }).click();

    // Now on PostJobScreen
    await expect(page.getByText('What kind of help do you need?').first()).toBeVisible();

    // Select category (e.g., Moving)
    await page.getByText('Moving').first().click();

    // Enter task description
    await page.getByPlaceholder('e.g. Need 2 people to move boxes from 3rd floor to ground floor.').first().fill('Test task: Need help moving a large sofa from 1st floor to 3rd floor.');

    // Enter amount (test minimum validation)
    await page.getByPlaceholder('Amount').first().fill('5');
    // Validate that the job isn't submitted (button is disabled)
    await expect(page.getByRole('button', { name: 'Post Job Now' }).first()).toBeDisabled();
    await page.getByPlaceholder('Amount').first().fill('50');

    // Click Post Job
    await page.getByRole('button', { name: 'Post Job Now' }).first().click();

    // Fill the Address Popup
    await expect(page.getByText('Add Address').first()).toBeVisible();
    await page.getByPlaceholder('House No, Building Name').first().fill('Test Complete Address');
    
    // Name and phone should already be pre-filled with mock profile, but let's ensure we click save
    await page.getByRole('button', { name: 'Save & Continue' }).first().click();

    // Should navigate to LiveStatusScreen
    await expect(page.getByText('Searching for Helpers...').first()).toBeVisible();

    // The mock data system simulates tasker acceptance after 6 seconds
    await page.waitForTimeout(7000);

    // Should navigate to CrewConfirmedScreen
    await expect(page.getByText('Crew Confirmed', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Your Crew is Set!').first()).toBeVisible();

    // Complete the task
    await page.getByText('Pay Offline').first().click();
    await page.getByRole('button', { name: /I Have Paid/i }).first().click();
    await page.getByRole('button', { name: 'Complete Task' }).first().click();

    // Rating Screen
    await expect(page.getByText('How was your experience?').first()).toBeVisible();
    // Click 5th star
    const stars = page.locator('.lucide-star');
    if (await stars.count() >= 5) {
      await stars.nth(4).click();
    }
    await page.getByRole('button', { name: 'Submit Feedback' }).first().click();

    // Job Receipt Screen
    await expect(page.getByText('Job Completed').first()).toBeVisible();
    await page.goto('/');

    // Verify job is now in active or completed
    await expect(page.getByText('My Active Jobs').first()).toBeVisible();
  });
});
