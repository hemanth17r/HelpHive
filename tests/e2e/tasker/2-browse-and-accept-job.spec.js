import { test, expect } from '@playwright/test';

test.describe('Tasker Flow - Browse & Accept Job', () => {
  test('should browse available jobs and accept one', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/');

    // Seed mock data
    await page.evaluate(() => {
      localStorage.setItem('mock_profiles', JSON.stringify([{
        id: 'tasker_test_1',
        role: 'tasker',
        name: 'Tasker Test',
        phone: '9988776655',
        skills: ['moving']
      }]));
      
      localStorage.setItem('mock_jobs', JSON.stringify([{
        id: 'job_test_1',
        poster_id: 'poster_test_1',
        skill_id: 'moving',
        description: 'Need help moving boxes',
        amount: 500,
        status: 'open',
        created_at: new Date().toISOString()
      }]));
      
      localStorage.setItem('userId', 'tasker_test_1');
      localStorage.setItem('activeRole', 'tasker');
    });

    // Reload to apply state and enter Tasker Home Screen
    await page.reload();

    // Verify Tasker Home
    await expect(page.getByText('Jobs Matching Your Skills').first()).toBeVisible();
    await expect(page.getByText('Need help moving boxes').first()).toBeVisible();

    // Click Accept on the Job Card
    await page.getByRole('button', { name: 'Accept' }).first().click();

    // Verify transition to Job Details Screen (Job in Progress)
    await expect(page.getByText('Job in Progress').first()).toBeVisible();
    await expect(page.getByText('Verify OTP to Start Job').first()).toBeVisible();

    // Enter OTP (fallback is 1234)
    await page.getByPlaceholder('Enter OTP').first().fill('1234');
    await page.getByRole('button', { name: 'Verify' }).first().click();

    // Verify OTP Verified! text
    await expect(page.getByText('OTP Verified!').first()).toBeVisible();

    // Complete Task
    await page.getByRole('button', { name: 'Mark Task Complete' }).first().click();

    // Verify transition to Rating Screen
    await expect(page.getByText('Rate the Hirer').first()).toBeVisible();

    // Leave a rating
    const stars = page.locator('.lucide-star');
    if (await stars.count() >= 5) {
      await stars.nth(4).click();
    }
    await page.getByRole('button', { name: 'Submit Review' }).first().click();

    // Verify Thank You! success text
    await expect(page.getByText('Thank You!').first()).toBeVisible();
  });
});
