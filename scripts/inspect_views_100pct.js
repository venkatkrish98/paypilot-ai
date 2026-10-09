const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const INSPECT_DIR = path.resolve('scratch/views_100pct');
if (!fs.existsSync(INSPECT_DIR)) {
  fs.mkdirSync(INSPECT_DIR, { recursive: true });
}

async function run() {
  const tmpProfile = path.join(os.tmpdir(), 'inspect_cdp_' + Date.now());
  fs.mkdirSync(tmpProfile, { recursive: true });

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--user-data-dir=' + tmpProfile,
    '--disable-gpu',
    '--window-size=1920,1080',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));

  const newTabRes = await fetch('http://localhost:9223/json/new?http://localhost:3000', { method: 'PUT' });
  const target = await newTabRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      const handler = (event) => {
        const d = JSON.parse(event.data);
        if (d.id === id) {
          ws.removeEventListener('message', handler);
          resolve(d.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const evalJs = async (expr) => {
    return await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  };

  await send('Page.enable');
  await send('Network.enable');
  // Device metrics at standard 1920x1080 with scale 1.0 (100% zoom)
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  // Reset database
  await fetch('http://localhost:3000/api/demo/reset', { method: 'POST' });
  await wait(1000);

  const capture = async (name) => {
    // Ensure zoom is 100% (reset)
    await evalJs(`document.documentElement.style.zoom = ''; document.body.style.zoom = '';`);
    await wait(400);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const imgPath = path.join(INSPECT_DIR, `${name}.png`);
    fs.writeFileSync(imgPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`Saved: ${name}.png`);
  };

  // 1. Dashboard
  await send('Page.navigate', { url: 'http://localhost:3000/?tab=dashboard' });
  await wait(2000);
  await capture('01_dashboard');

  // Scroll down a bit on dashboard
  await evalJs('window.scrollTo(0, 350);');
  await wait(400);
  await capture('01_dashboard_scrolled');

  // 2. Agent Command Center
  await send('Page.navigate', { url: 'http://localhost:3000/?tab=agent' });
  await wait(1500);
  await capture('02_agent');

  // 3. Approvals Queue
  await send('Page.navigate', { url: 'http://localhost:3000/?tab=approvals' });
  await wait(1500);
  await capture('03_approvals');

  // 4. Activity
  await send('Page.navigate', { url: 'http://localhost:3000/?tab=activity' });
  await wait(1500);
  await capture('04_activity');

  // 5. Settings
  await send('Page.navigate', { url: 'http://localhost:3000/?tab=settings' });
  await wait(1500);
  await capture('05_settings');

  // 6. Summary Takeaway
  await send('Page.navigate', { url: 'http://localhost:3000/?tab=summary' });
  await wait(1500);
  await capture('06_summary');

  chrome.kill();
  console.log('Inspection complete.');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
