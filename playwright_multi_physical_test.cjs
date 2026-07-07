const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join('C:', 'Users', 'AKKALA HEMANTH REDDY', '.gemini', 'antigravity', 'brain', 'cfce73c8-6d8e-4252-b6c0-422ff372cd95', 'remote_screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

(async () => {
  console.log('Starting Playwright E2E Multi-User Physical Task Test...');
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext({
    permissions: ['geolocation', 'notifications'],
    geolocation: { latitude: 12.9716, longitude: 77.5946 },
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

  try {
    // 1. Initial page load to allow setting localStorage
    console.log('Loading app for setting Poster session...');
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(1000);

    // 2. Mock login as Poster (tester1_poster) with full profile caching to bypass wizard
    await page.evaluate(() => {
      localStorage.clear();
      const userId = '11111111-1111-1111-1111-111111111111';
      localStorage.setItem('userId', userId);
      localStorage.setItem('activeRole', 'poster');
      localStorage.setItem(`helphive_wizard_completed_poster_${userId}`, 'true');
      
      const profile = {
        id: userId,
        name: 'tester1_poster',
        email: 'tester1@helphive.com',
        role: 'poster',
        phone: '9999999901',
        bird: 'sparrow'
      };
      localStorage.setItem('userProfile', JSON.stringify(profile));
      
      const location = { lat: 12.9716, lng: 77.5946 };
      localStorage.setItem('userLocation', JSON.stringify(location));

      const addresses = [{
        id: '73dd0228-9d30-4512-98d5-b7aecf2ee341',
        label: 'Home',
        formattedAddress: 'MG Road, Bangalore, Karnataka, India',
        isDefault: true,
        city: 'Bangalore',
        coordinates: location
      }];
      localStorage.setItem('helphive_addresses_v2', JSON.stringify(addresses));
    });

    // Reload with poster session active
    console.log('Navigating to Poster dashboard...');
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(2000);

    // 3. Post a Job with 2 Helpers
    console.log('Clicking Post a Task button...');
    await page.click('button:has-text("Post a Task")');
    await page.waitForTimeout(1500);

    console.log('Selecting Moving category...');
    await page.locator('span').filter({ hasText: /^Shift & Load$/ }).first().click();
    await page.waitForTimeout(500);

    console.log('Increasing crew count to 2...');
    await page.locator('button').filter({ has: page.locator('.lucide-plus') }).first().click();
    await page.waitForTimeout(500);

    console.log('Filling description...');
    await page.fill('textarea', '[TEST] Multi-User Physical Job');
    await page.waitForTimeout(500);

    console.log('Filling amount...');
    await page.fill('input[placeholder="Amount"]', '500');
    await page.waitForTimeout(500);

    console.log('Submitting task...');
    await page.click('button:has-text("Post")');
    await page.waitForTimeout(4000); // Wait for waves and matches

    // 4. Switch to Tasker 1 (tester2_tasker_near) programmatically
    console.log('Programmatically switching to Tasker 1...');
    await page.evaluate(() => {
      const persona = { id: '22222222-2222-2222-2222-222222222222', name: 'tester2_tasker_near', role: 'tasker' };
      localStorage.setItem('userId', persona.id);
      localStorage.setItem('activeRole', persona.role);
      localStorage.setItem('userProfile', JSON.stringify({ ...persona, bird: 'falcon', skills: ['moving', 'events', 'video_editing'] }));
      window.location.reload();
    });
    await page.waitForTimeout(4000);

    console.log('Tasker 1 accepting job...');
    await page.click('button:has-text("Accept")', { force: true });
    await page.waitForTimeout(3000);

    // 5. Switch to Tasker 2 (tester6_tasker_near2) programmatically
    console.log('Programmatically switching to Tasker 2...');
    await page.evaluate(() => {
      const persona = { id: '66666666-6666-6666-6666-666666666666', name: 'tester6_tasker_near2', role: 'tasker' };
      localStorage.setItem('userId', persona.id);
      localStorage.setItem('activeRole', persona.role);
      localStorage.setItem('userProfile', JSON.stringify({ ...persona, bird: 'falcon', skills: ['moving', 'events', 'video_editing'] }));
      window.location.reload();
    });
    await page.waitForTimeout(4000);

    console.log('Tasker 2 accepting job...');
    await page.click('button:has-text("Accept")', { force: true });
    await page.waitForTimeout(3000);

    // 6. Switch back to Poster to view the CrewConfirmedScreen
    console.log('Programmatically switching back to Poster...');
    await page.evaluate(() => {
      const persona = { id: '11111111-1111-1111-1111-111111111111', name: 'tester1_poster', role: 'poster' };
      localStorage.setItem('userId', persona.id);
      localStorage.setItem('activeRole', persona.role);
      localStorage.setItem('userProfile', JSON.stringify({ ...persona, bird: 'sparrow', skills: [] }));
      window.location.reload();
    });
    await page.waitForTimeout(4000);

    console.log('Opening crew set screen...');
    await page.click('text="[TEST] Multi-User Physical Job"');
    await page.waitForTimeout(2000);

    // Take screenshot of Crew Confirmed Screen showing 2 Taskers
    await page.screenshot({ path: path.join(screenshotDir, 'step6_crew_confirmed_physical.png') });
    console.log('Screenshot step6_crew_confirmed_physical.png saved.');

    // 7. Verify OTP for Tasker 1 (tester2_tasker_near)
    console.log('Programmatically switching to Tasker 1 for OTP...');
    await page.evaluate(() => {
      const persona = { id: '22222222-2222-2222-2222-222222222222', name: 'tester2_tasker_near', role: 'tasker' };
      localStorage.setItem('userId', persona.id);
      localStorage.setItem('activeRole', persona.role);
      localStorage.setItem('userProfile', JSON.stringify({ ...persona, bird: 'falcon', skills: ['moving', 'events', 'video_editing'] }));
      window.location.reload();
    });
    await page.waitForTimeout(4000);

    console.log('Opening accepted job card...');
    await page.click('text="[TEST] Multi-User Physical Job"');
    await page.waitForTimeout(2000);

    console.log('Tasker 1 entering OTP...');
    await page.fill('input[placeholder="Enter OTP"]', '1234');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Verify")', { force: true });
    await page.waitForTimeout(3000);

    // 8. Verify OTP for Tasker 2 (tester6_tasker_near2)
    console.log('Programmatically switching to Tasker 2 for OTP...');
    await page.evaluate(() => {
      const persona = { id: '66666666-6666-6666-6666-666666666666', name: 'tester6_tasker_near2', role: 'tasker' };
      localStorage.setItem('userId', persona.id);
      localStorage.setItem('activeRole', persona.role);
      localStorage.setItem('userProfile', JSON.stringify({ ...persona, bird: 'falcon', skills: ['moving', 'events', 'video_editing'] }));
      window.location.reload();
    });
    await page.waitForTimeout(4000);

    console.log('Opening accepted job card...');
    await page.click('text="[TEST] Multi-User Physical Job"');
    await page.waitForTimeout(2000);

    console.log('Tasker 2 entering OTP...');
    await page.fill('input[placeholder="Enter OTP"]', '1234');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Verify")', { force: true });
    await page.waitForTimeout(3000);

    // 9. Switch back to Poster to mark complete
    console.log('Programmatically switching back to Poster for completion...');
    await page.evaluate(() => {
      const persona = { id: '11111111-1111-1111-1111-111111111111', name: 'tester1_poster', role: 'poster' };
      localStorage.setItem('userId', persona.id);
      localStorage.setItem('activeRole', persona.role);
      localStorage.setItem('userProfile', JSON.stringify({ ...persona, bird: 'sparrow', skills: [] }));
      window.location.reload();
    });
    await page.waitForTimeout(4000);

    console.log('Opening job in-progress screen...');
    await page.click('text="[TEST] Multi-User Physical Job"');
    await page.waitForTimeout(2000);

    // Take screenshot of progress bar with both helper started
    await page.screenshot({ path: path.join(screenshotDir, 'step7_in_progress_physical.png') });
    console.log('Screenshot step7_in_progress_physical.png saved.');

    console.log('Clicking Pay Offline...');
    await page.click('text=Pay Offline', { force: true });
    await page.waitForTimeout(1000);

    console.log('Clicking Confirm Payments & Complete...');
    await page.click('text=Confirm Payments & Complete');
    await page.waitForTimeout(1000);

    console.log('Clicking Complete Task in confirmation modal...');
    await page.click('button:has-text("Complete Task")');
    await page.waitForTimeout(4000); // Wait for redirect to RatingScreen

    // Take screenshot of Rating Screen showing both taskers
    await page.screenshot({ path: path.join(screenshotDir, 'step8_rating_screen_physical.png') });
    console.log('Screenshot step8_rating_screen_physical.png saved.');

    console.log('Multi-user physical task E2E test completed successfully!');

  } catch (error) {
    console.error('Test execution failed:', error);
    try {
      console.log('Current Page URL on failure:', page.url());
      await page.screenshot({ path: path.join(screenshotDir, 'failure_diagnostic.png') });
      console.log('Diagnostic failure screenshot saved.');
    } catch (diagError) {
      console.error('Failed to capture diagnostic screenshot:', diagError);
    }
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed.');
  }
})();
