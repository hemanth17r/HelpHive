const { chromium } = require('playwright');

(async () => {
  console.log('Starting Playwright E2E Visual Test (Fast Mode)...');
  const browser = await chromium.launch({ headless: true });
  
  // Grant permissions on startup (No video recording to maximize speed)
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
    await page.waitForTimeout(2000); // Wait for API calls

    // 3. Post a Task
    console.log('Clicking Post a Task button...');
    await page.click('button:has-text("Post a Task")');
    await page.waitForTimeout(1500);

    console.log('Selecting Moving category...');
    // Precision matching of the span text inside the grid button
    await page.locator('span').filter({ hasText: /^Shift & Load$/ }).first().click();
    await page.waitForTimeout(500);

    console.log('Filling description...');
    await page.fill('textarea', '[TEST] Moving heavy furniture');
    await page.waitForTimeout(500);

    console.log('Filling amount...');
    await page.fill('input[placeholder="Amount"]', '500');
    await page.waitForTimeout(500);

    console.log('Submitting task...');
    await page.click('button:has-text("Post")');
    await page.waitForTimeout(4000); // Wait for waves and matches

    // 4. Switch to Tasker (tester2_tasker_near)
    console.log('Opening Dev Console to switch session...');
    await page.click('button[title="HelpHive Developer Tools"]');
    await page.waitForTimeout(1000);

    console.log('Clicking tester2_tasker_near...');
    await page.click('button:has-text("tester2_tasker_near")');
    await page.waitForTimeout(4000); // Wait for page reload and fetches

    // 5. Accept Job Offer
    console.log('Accepting job offer...');
    await page.click('button:has-text("Accept")');
    await page.waitForTimeout(3000);

    // 6. Enter OTP
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

    console.log('E2E test visual flow completed successfully!');

  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Browser closed.');
  }
})();
