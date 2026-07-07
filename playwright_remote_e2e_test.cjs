const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join('C:', 'Users', 'AKKALA HEMANTH REDDY', '.gemini', 'antigravity', 'brain', 'cfce73c8-6d8e-4252-b6c0-422ff372cd95', 'remote_screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

(async () => {
  console.log('Starting Playwright E2E Remote Task Visual Test...');
  const browser = await chromium.launch({ headless: true });
  
  // Grant permissions on startup
  const context = await browser.newContext({
    permissions: ['geolocation', 'notifications'],
    geolocation: { latitude: 12.9716, longitude: 77.5946 },
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Console logs and page errors logging
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

    // 3. Post a Remote Task
    console.log('Clicking Post a Task button...');
    await page.click('button:has-text("Post a Task")');
    await page.waitForTimeout(1500);

    console.log('Selecting Video & Reels Editing category...');
    // Precision matching for remote category using short label
    await page.locator('span').filter({ hasText: /Video Edit/ }).first().click();
    await page.waitForTimeout(500);

    console.log('Filling description...');
    await page.fill('textarea', '[TEST] Remote reels video editing task');
    await page.waitForTimeout(500);

    console.log('Filling amount...');
    await page.fill('input[placeholder="Amount"]', '600');
    await page.waitForTimeout(500);

    // Take screenshot of Post Job Form
    await page.screenshot({ path: path.join(screenshotDir, 'step1_post_job_remote.png') });
    console.log('Screenshot step1_post_job_remote.png saved.');

    console.log('Submitting task...');
    await page.click('button:has-text("Post")');
    await page.waitForTimeout(4000); // Wait for waves and matches

    // Take screenshot of searching state
    await page.screenshot({ path: path.join(screenshotDir, 'step2_searching_remote.png') });
    console.log('Screenshot step2_searching_remote.png saved.');

    // 4. Switch to Tasker (tester2_tasker_near)
    console.log('Opening Dev Console to switch session...');
    await page.click('button[title="HelpHive Developer Tools"]');
    await page.waitForTimeout(1000);

    console.log('Clicking tester2_tasker_near...');
    await page.click('button:has-text("tester2_tasker_near")');
    await page.waitForTimeout(4000); // Wait for page reload and fetches

    // Take screenshot of tasker dashboard feed
    await page.screenshot({ path: path.join(screenshotDir, 'step3_tasker_feed_remote.png') });
    console.log('Screenshot step3_tasker_feed_remote.png saved.');

    // 5. Accept Job Offer
    console.log('Accepting job offer...');
    await page.click('button:has-text("Accept")');
    await page.waitForTimeout(3000);

    // Take screenshot of tasker accepted details screen (should show "Remote Connection" and no map)
    await page.screenshot({ path: path.join(screenshotDir, 'step4_tasker_details_remote.png') });
    console.log('Screenshot step4_tasker_details_remote.png saved.');

    // 6. Enter OTP to start task
    console.log('Entering OTP...');
    await page.fill('input[placeholder="Enter OTP"]', '1234');
    await page.waitForTimeout(500);

    console.log('Clicking Verify...');
    await page.click('button:has-text("Verify")');
    await page.waitForTimeout(3000);

    // 7. Mark Task Complete
    console.log('Marking task as complete...');
    await page.click('button:has-text("Mark Task Complete")');
    await page.waitForTimeout(3000);

    // 8. Switch back to Poster to review and rate
    console.log('Opening Dev Console to switch back to Poster...');
    await page.click('button[title="HelpHive Developer Tools"]');
    await page.waitForTimeout(1000);

    console.log('Clicking tester1_poster...');
    await page.click('button:has-text("tester1_poster")');
    await page.waitForTimeout(4000); // Wait for page reload

    // Take screenshot of poster confirmed receipt / review screen
    await page.screenshot({ path: path.join(screenshotDir, 'step5_receipt_remote.png') });
    console.log('Screenshot step5_receipt_remote.png saved.');

    console.log('Remote visual E2E test completed successfully!');

  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed.');
  }
})();
