const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);

  // Take a screenshot to see if it's blank
  await page.screenshot({ path: 'screenshot.png' });

  await browser.close();
})();
