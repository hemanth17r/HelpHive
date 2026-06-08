import { test, expect } from '@playwright/test';

test.describe('Comprehensive E2E Flow', () => {
  test('should create new profiles, post job, accept job, and verify features', async ({ browser }) => {
    // We use two separate browser contexts to simulate two different users (Hirer and Tasker)
    const taskerContext = await browser.newContext({
      geolocation: { longitude: 75.698, latitude: 31.255 },
      permissions: ['geolocation']
    });
    const posterContext = await browser.newContext({
      geolocation: { longitude: 75.700, latitude: 31.256 },
      permissions: ['geolocation']
    });
    
    const taskerPage = await taskerContext.newPage();
    const posterPage = await posterContext.newPage();
    
    // Unique phone numbers to ensure fresh profiles in the DB
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const taskerPhone = `8888${randomSuffix}`;
    const posterPhone = `9999${randomSuffix}`;

    // ----------------------------------------------------
    // 1. Tasker Setup & Profile Creation
    // ----------------------------------------------------
    await taskerPage.goto('/');
    
    // Verify landing page
    await expect(taskerPage.getByText('Get trusted local help, fast.').first()).toBeVisible();
    
    // Select Tasker Role
    await taskerPage.getByText('I Want to Work').first().click();

    // Profile Completion for Tasker (Triggered via Carousel)
    await taskerPage.getByText('Complete Profile', { exact: true }).first().click();
    await expect(taskerPage.getByText('Complete Profile', { exact: true }).first()).toBeVisible();
    await taskerPage.getByPlaceholder('e.g. John Doe').fill('E2E Tasker');
    await taskerPage.getByPlaceholder('e.g. 987-654-3210').fill(taskerPhone);
    await taskerPage.getByRole('button', { name: 'Save & Continue' }).click();

    // Wait for Tasker Onboarding (Triggered via Carousel)
    await taskerPage.getByText('Setup Skills').first().click();
    await expect(taskerPage.getByText('What Can You Do?').first()).toBeVisible();
    
    // Select Skills
    await taskerPage.getByText('Moving').first().click();
    await taskerPage.getByRole('button', { name: 'Start Earning' }).click();

    // Wait to return to Home Screen
    await expect(taskerPage.getByText('Jobs Matching Your Skills').first()).toBeVisible();

    // Set UPI ID (Triggered via Carousel)
    await taskerPage.getByText('Add UPI ID').first().click();
    await expect(taskerPage.getByText('Earnings Overview').first()).toBeVisible();
    await taskerPage.getByPlaceholder('e.g. username@okhdfcbank').first().fill('e2etasker@upi');
    await taskerPage.getByRole('button', { name: 'Save UPI ID' }).first().click();
    
    // Navigate back to Home
    await taskerPage.locator('#tasker-activity-back-btn').first().click();

    // Verify Tasker is on Home Screen
    await expect(taskerPage.getByText('Jobs Matching Your Skills').first()).toBeVisible();

    // ----------------------------------------------------
    // 2. Poster Setup, Profile Creation, & Job Posting
    // ----------------------------------------------------
    await posterPage.goto('/');
    await posterPage.getByRole('button', { name: /I Need Help/i }).click();

    // Click "Post a Job"
    await posterPage.getByRole('button', { name: /Post a Job/i }).first().click();

    // Profile Completion for Poster
    await expect(posterPage.getByText('Complete Profile', { exact: true }).first()).toBeVisible();
    await posterPage.getByPlaceholder('e.g. John Doe').fill('E2E Poster');
    await posterPage.getByPlaceholder('e.g. 987-654-3210').fill(posterPhone);
    await posterPage.getByRole('button', { name: 'Save & Continue' }).click();

    // Now on PostJobScreen
    await expect(posterPage.getByText('What kind of help do you need?').first()).toBeVisible();
    
    // Select category (Moving, which matches Tasker's skill)
    await posterPage.getByText('Moving').first().click();
    
    const taskDesc = `E2E Test task ${randomSuffix}`;
    await posterPage.getByPlaceholder('e.g. Need 2 people').first().fill(taskDesc);
    await posterPage.getByPlaceholder('Amount').first().fill('500');

    // Click Post Job Now
    await posterPage.getByRole('button', { name: 'Post Job Now' }).first().click();

    // Handle Address Popup
    await expect(posterPage.getByText('Add Address').first()).toBeVisible();
    await posterPage.getByPlaceholder('House No, Building Name').first().fill('123 E2E Street');
    // We expect the name and phone to be pre-filled as "E2E Poster" and posterPhone
    await expect(posterPage.getByPlaceholder('Full Name').first()).toHaveValue('E2E Poster');
    await expect(posterPage.getByPlaceholder('123-456-7890').first()).toHaveValue(posterPhone);
    
    await posterPage.getByRole('button', { name: 'Save & Continue' }).first().click();

    // Wait for LiveStatusScreen
    await expect(posterPage.getByText('Searching for Helpers...').first()).toBeVisible();

    // ----------------------------------------------------
    // 3. Tasker Browse & Accept Job
    // ----------------------------------------------------
    // Tasker should see the new job appear
    // We might need to reload or wait for realtime update
    await expect(taskerPage.getByText(taskDesc).first()).toBeVisible({ timeout: 10000 });
    
    // Accept the job
    const jobCard = taskerPage.locator('.bg-white', { hasText: taskDesc }).first();
    await jobCard.getByRole('button', { name: 'Accept' }).first().click();

    // Tasker goes to Job in Progress
    await expect(taskerPage.getByText('Job in Progress').first()).toBeVisible();
    await expect(taskerPage.getByText('Verify OTP to Start Job').first()).toBeVisible();

    // ----------------------------------------------------
    // 4. Poster sees Crew Confirmed and provides OTP
    // ----------------------------------------------------
    await expect(posterPage.getByText('Crew Confirmed', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(posterPage.getByText('Your Crew is Set!').first()).toBeVisible();
    
    // Extract OTP from Poster Screen
    await posterPage.getByRole('button', { name: 'Reveal OTP' }).first().click();
    const otpElement = posterPage.locator('.text-2xl.tracking-widest').first();
    await expect(otpElement).toBeVisible();
    const otpText = await otpElement.innerText(); // e.g. "1234"
    const otp = otpText.trim();

    // ----------------------------------------------------
    // 5. Tasker enters OTP & Completes Job
    // ----------------------------------------------------
    await taskerPage.getByPlaceholder('Enter OTP').first().fill(otp);
    await taskerPage.getByRole('button', { name: 'Verify' }).first().click();
    await expect(taskerPage.getByText('OTP Verified!').first()).toBeVisible();

    await taskerPage.getByRole('button', { name: 'Mark Task Complete' }).first().click();
    await expect(taskerPage.getByText('Rate the Hirer').first()).toBeVisible();

    // ----------------------------------------------------
    // 6. Poster flows to Payment & Rating
    // ----------------------------------------------------
    await expect(posterPage.getByText('Pay Offline').first()).toBeVisible({ timeout: 10000 });
    await posterPage.getByText('Pay Offline').first().click();
    await posterPage.getByRole('button', { name: /I Have Paid/i }).first().click();
    await posterPage.getByRole('button', { name: 'Complete Task' }).first().click();

    // Poster rating screen
    await expect(posterPage.getByText('How was your experience?').first()).toBeVisible();
    await posterPage.getByRole('button', { name: 'Submit Feedback' }).first().click();
    await expect(posterPage.getByRole('heading', { name: 'Post a Job' }).first()).toBeVisible();

    // ----------------------------------------------------
    // 7. Verify Notifications and Profile Info
    // ----------------------------------------------------
    // Tasker submits rating
    await taskerPage.getByRole('button', { name: 'Submit Review' }).first().click();
    await expect(taskerPage.getByText('Thank You!').first()).toBeVisible();

    // Both should have some notifications (simulated or real)
    await taskerPage.goto('/');
    const taskerBell = taskerPage.locator('.lucide-bell').first();
    await taskerBell.click();
    await expect(taskerPage.getByText('Notifications').first()).toBeVisible();

    await posterPage.goto('/');
    const posterBell = posterPage.locator('.lucide-bell').first();
    await posterBell.click();
    await expect(posterPage.getByText('Notifications').first()).toBeVisible();
    
    await taskerContext.close();
    await posterContext.close();
  });
});
