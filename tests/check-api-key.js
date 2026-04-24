const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
  await page.goto(baseUrl + '/login');

  const storage = await page.evaluate(() => ({
    authToken: localStorage.getItem('auth_token'),
    user: localStorage.getItem('user'),
  }));

  if (storage.authToken) {
    console.log('鉁?宸叉娴嬪埌鐧诲綍鎬?token:', storage.authToken.substring(0, 10) + '...');
  } else {
    console.log('鈩癸笍 褰撳墠娴忚鍣ㄦ湰鍦板瓨鍌ㄤ腑娌℃湁 auth_token');
  }

  console.log(storage.user ? '鉁?宸叉娴嬪埌鐢ㄦ埛淇℃伅缂撳瓨' : '鈩癸笍 褰撳墠娴忚鍣ㄦ湰鍦板瓨鍌ㄤ腑娌℃湁鐢ㄦ埛淇℃伅缂撳瓨');
  await browser.close();
})();
