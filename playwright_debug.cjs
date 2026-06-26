const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Print all page console logs to terminal
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

  // 1. Go to homepage first
  await page.goto('http://localhost:3000/');
  
  // 2. Set user session in localStorage (HR profile id: '023288da-7cab-4bc7-99ef-affe319e3513')
  await page.evaluate(() => {
    localStorage.setItem('userId', '023288da-7cab-4bc7-99ef-affe319e3513');
    localStorage.setItem('activeRole', 'tasker');
    // Cached userProfile object to avoid initial loading delay issues
    const profile = {
      id: '023288da-7cab-4bc7-99ef-affe319e3513',
      name: 'HR',
      role: 'tasker',
      bird: 'falcon'
    };
    localStorage.setItem('userProfile', JSON.stringify(profile));
  });

  console.log("\n--- NAVIGATING TO MY_PROFILE ---");
  await page.goto('http://localhost:3000/my_profile');
  await page.waitForTimeout(4000); // Wait for Supabase fetches

  console.log("\n--- NAVIGATING TO JOB_HISTORY ---");
  await page.goto('http://localhost:3000/job_history');
  await page.waitForTimeout(4000); // Wait for Supabase fetches

  await browser.close();
})();
