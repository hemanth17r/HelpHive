import { test, expect } from '@playwright/test';

test.describe('Poster (Hirer) Flow - Landing & Home', () => {
  test('should load landing page and select Poster role', async ({ page }) => {
    await page.goto('/');

    // Verify Hero text
    await expect(page.locator('text=HelpHive').first()).toBeVisible();
    await expect(page.getByText('Hyperlocal helpers at your doorstep in seconds.').first()).toBeVisible();

    // Select "I Need Help" (Poster role)
    await page.getByRole('button', { name: /I Need Help/i }).click();

    // Should navigate to Poster Home Screen
    // Verify Poster Home elements: "Post a Job" button
    await expect(page.getByRole('button', { name: /Post a Job/i })).toBeVisible();
    
    // Verify active jobs section
    await expect(page.getByText('My Active Jobs').first()).toBeVisible();
    await expect(page.getByText('No active jobs. Post your first job.').first()).toBeVisible();
  });
});
