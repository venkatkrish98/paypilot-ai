// ==============================================================================
// PayPilot AI - Broadcast 1080p Demo Video Generator
// Uses Gemini 2.5 TTS + Chrome CDP + FFmpeg
// Perfectly framed 16:9 1080p, Zero Top Cutoff, Full-Width Coverage
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { GoogleGenAI } = require('@google/genai');

const OUTPUT_DIR = path.resolve('video_assets');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Narration Script & Scene Definitions
const SCENES = [
  {
    id: 'scene1_problem',
    title: 'The Problem: Passive Payments & Administrative Friction',
    url: 'http://localhost:3000',
    text: 'Freelancers, agencies, and businesses lose countless hours manually managing payments, generating payment links, and chasing unpaid invoices. Traditional payment buttons are passive—they do not understand context, they do not follow up, and they cannot make smart financial decisions.'
  },
  {
    id: 'scene2_dashboard',
    title: 'Introducing PayPilot AI: Autonomous Commerce Agent for PayPal',
    url: 'http://localhost:3000',
    text: 'Introducing PayPilot AI: your autonomous payment agent for getting paid, paying safely, and managing every transaction. Built for the PayPal AI Hackathon 2026, PayPilot transforms payment lifecycles into proactive, goal-driven workflows powered by PayPal\'s official Orders API.'
  },
  {
    id: 'scene3_hero_workflow',
    title: 'The Hero Workflow: Natural Language to Live PayPal Order',
    url: 'http://localhost:3000/?tab=agent',
    text: 'Watch the hero workflow in action. With a single instruction—Collect $1,200 from Sarah for the website project by Friday—PayPilot\'s multi-agent system springs into action. Powered by Google Gemini 3.8 Flash, the Intent Agent extracts structured parameters. The Customer Agent identifies Sarah Jenkins. The Risk Agent executes an itemized 5-point payment safety check. And the Payment Agent generates an official PayPal order with an instant checkout link.'
  },
  {
    id: 'scene4_capture',
    title: 'Autonomous Monitoring & Real-Time Payment Capture',
    url: 'http://localhost:3000/?tab=goals',
    text: 'PayPilot does not stop after creating the order. Its Follow-up Agent actively monitors transaction completion. Once payment is captured, PayPilot detects the event, updates the customer ledger, and closes the payment goal in real time.'
  },
  {
    id: 'scene5_approvals',
    title: 'Risk Engine & Human-in-the-Loop Dual Authorization',
    url: 'http://localhost:3000/?tab=approvals',
    text: 'Financial autonomy demands safety. For high-risk disbursements or new vendors, PayPilot enforces human sign-off. When vendor Mike Reynolds requires a $2,500 disbursement exceeding our $2,000 threshold, PayPilot pauses execution and alerts the administrator. The admin reviews the itemized risk findings and authorizes the review. PayPilot strictly gates outbound payouts—recording the safety sign-off without auto-disbursing funds—ensuring capital is never transferred without dedicated dual authorization.'
  },
  {
    id: 'scene6_settings_closing',
    title: 'Verified Live Intelligence & Provenance Gating',
    url: 'http://localhost:3000/?tab=settings',
    text: 'PayPilot AI features autonomous customer memory, verified live Google Gemini AI reasoning, and direct PayPal Sandbox integration. It is more than a chatbot—it is an intelligent action agent completing the commerce loop. Thank you.'
  }
];

async function main() {
  console.log('=== PayPilot AI Demo Video Pipeline (Full 1080p Framing) ===');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1. Generate Voiceover Audio Files (or reuse if present)
  console.log('\n[1/4] Preparing AI Voiceover Tracks with Gemini TTS...');
  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const mp3Path = path.join(OUTPUT_DIR, `${scene.id}.mp3`);
    if (!fs.existsSync(mp3Path)) {
      console.log(`Generating audio for ${scene.id}...`);
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: scene.text,
        config: { responseModalities: ['AUDIO'] }
      });
      const data = res.candidates[0].content.parts[0].inlineData.data;
      const pcmPath = path.join(OUTPUT_DIR, `${scene.id}.pcm`);
      fs.writeFileSync(pcmPath, Buffer.from(data, 'base64'));
      execSync(`ffmpeg -y -f s16le -ar 24000 -ac 1 -i "${pcmPath}" "${mp3Path}"`);
      fs.unlinkSync(pcmPath);
    }
    const durStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mp3Path}"`).toString().trim();
    scene.duration = parseFloat(durStr);
    console.log(`✓ ${scene.id}: ${scene.duration.toFixed(2)}s`);
  }

  // 2. Start Chrome Headless & Capture Visuals with 82% Zoom & Top Alignment
  console.log('\n[2/4] Capturing Pixel-Perfect 1080p Screen Renderings via Chrome CDP...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1920,1080',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));

  const res = await fetch('http://localhost:9222/json/new?http://localhost:3000', { method: 'PUT' });
  const target = await res.json();
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

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await wait(3000);

  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    console.log(`Rendering visual for ${scene.id} (${scene.url})...`);
    await send('Page.navigate', { url: scene.url });
    await wait(2500);

    // Apply strict 82% zoom and scroll to (0, 0) for zero cutoff
    await send('Runtime.evaluate', {
      expression: "document.documentElement.style.zoom = '82%'; window.scrollTo(0, 0);"
    });
    await wait(800);

    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const imgPath = path.join(OUTPUT_DIR, `${scene.id}.png`);
    fs.writeFileSync(imgPath, Buffer.from(screenshot.data, 'base64'));
    scene.imagePath = imgPath;
    console.log(`✓ Captured ${scene.id}.png`);
  }

  ws.close();
  chrome.kill();

  // 3. Render Individual Scene Clips with FFmpeg
  console.log('\n[3/4] Rendering Synchronized 1080p Scene Clips...');
  const clipPaths = [];
  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const clipPath = path.join(OUTPUT_DIR, `${scene.id}.mp4`);
    clipPaths.push(clipPath);

    const mp3Path = path.join(OUTPUT_DIR, `${scene.id}.mp3`);
    const imgPath = path.join(OUTPUT_DIR, `${scene.id}.png`);
    const duration = (scene.duration + 0.8).toFixed(2); // small breathing pause

    // Encode still image to 1080p video with AAC audio
    const ffmpegCmd = `ffmpeg -y -loop 1 -i "${imgPath}" -i "${mp3Path}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -t ${duration} "${clipPath}"`;
    execSync(ffmpegCmd, { stdio: 'pipe' });
    console.log(`✓ Rendered ${scene.id}.mp4 (${duration}s)`);
  }

  // 4. Concatenate Clips into Final Demo Video
  console.log('\n[4/4] Muxing Final Demo Video (paypilot_ai_demo.mp4)...');
  const concatListPath = path.join(OUTPUT_DIR, 'concat_list.txt');
  const concatContent = clipPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  const finalVideoPath = path.resolve('paypilot_ai_demo.mp4');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy "${finalVideoPath}"`, { stdio: 'pipe' });

  // Copy to artifacts directory
  const artifactVideoPath = 'C:\\Users\\venka\\.gemini\\antigravity-ide\\brain\\0a42b8c7-1329-400a-97ca-a4920242ce2d\\paypilot_ai_demo.mp4';
  fs.copyFileSync(finalVideoPath, artifactVideoPath);

  const finalDur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalVideoPath}"`).toString().trim();
  const finalSize = (fs.statSync(finalVideoPath).size / (1024 * 1024)).toFixed(2);

  console.log('\n======================================================');
  console.log(` SUCCESS! Demo Video Generated: ${finalVideoPath}`);
  console.log(` Copied to Artifacts: ${artifactVideoPath}`);
  console.log(` Total Duration: ${parseFloat(finalDur).toFixed(1)} seconds (${(parseFloat(finalDur) / 60).toFixed(2)} min)`);
  console.log(` File Size: ${finalSize} MB`);
  console.log(` Complies with Hackathon < 3 minute rule: ${parseFloat(finalDur) < 180 ? 'YES' : 'NO'}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Video generation error:', err);
  process.exit(1);
});
