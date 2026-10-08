// ==============================================================================
// PayPilot AI - Automated Demo Video Generator
// Uses Gemini 2.5 TTS + Chrome CDP + FFmpeg for Broadcast 1080p MP4
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const { GoogleGenAI } = require('@google/genai');

const OUTPUT_DIR = path.resolve('video_assets');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Narration Script
const SCENES = [
  {
    id: 'scene1_problem',
    title: 'The Problem: Passive Payments & Administrative Friction',
    text: 'Freelancers, agencies, and businesses lose countless hours manually managing payments, generating payment links, and chasing unpaid invoices. Traditional payment buttons are passive—they do not understand context, they do not follow up, and they cannot make smart financial decisions.',
    action: async (send, wait) => {
      // Navigate to Dashboard
      await send('Page.navigate', { url: 'http://localhost:3000' });
      await wait(3000);
    }
  },
  {
    id: 'scene2_dashboard',
    title: 'Introducing PayPilot AI: Autonomous Commerce Agent for PayPal',
    text: 'Introducing PayPilot AI: your autonomous payment agent for getting paid, paying safely, and managing every transaction. Built for the PayPal AI Hackathon 2026, PayPilot transforms payment lifecycles into proactive, goal-driven workflows powered by PayPal\'s official Orders API.',
    action: async (send, wait) => {
      await send('Page.navigate', { url: 'http://localhost:3000' });
      await wait(2500);
    }
  },
  {
    id: 'scene3_hero_workflow',
    title: 'The Hero Workflow: Natural Language to Live PayPal Order',
    text: 'Watch the hero workflow in action. With a single instruction—Collect $1,200 from Sarah for the website project by Friday—PayPilot\'s multi-agent system springs into action. Powered by Google Gemini 3.8 Flash, the Intent Agent extracts structured parameters. The Customer Agent identifies Sarah Jenkins. The Risk Agent executes an itemized 5-point payment safety check. And the Payment Agent generates an official PayPal order with an instant checkout link.',
    action: async (send, wait) => {
      // Click Hero Demo Flow button or focus Command Center
      await send('Runtime.evaluate', {
        expression: `
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run Hero Demo Flow') || b.textContent.includes('Sarah'));
          if (btn) btn.click();
        `
      });
      await wait(3000);
    }
  },
  {
    id: 'scene4_capture',
    title: 'Autonomous Monitoring & Real-Time Payment Capture',
    text: 'PayPilot does not stop after creating the order. Its Follow-up Agent actively monitors transaction completion. Once payment is captured, PayPilot detects the event, updates the customer ledger, and closes the payment goal in real time.',
    action: async (send, wait) => {
      // Navigate to Goals tab or inspect Active Goals
      await send('Runtime.evaluate', {
        expression: `
          const goalsTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Payment Goals') || b.textContent.includes('Goals'));
          if (goalsTab) goalsTab.click();
        `
      });
      await wait(2500);
    }
  },
  {
    id: 'scene5_approvals',
    title: 'Risk Engine & Human-in-the-Loop Dual Authorization',
    text: 'Financial autonomy demands safety. For high-risk disbursements or new vendors, PayPilot enforces human sign-off. When vendor Mike Reynolds requires a $2,500 disbursement exceeding our $2,000 threshold, PayPilot pauses execution and alerts the administrator. The admin reviews the itemized risk findings and authorizes the review. PayPilot strictly gates outbound payouts—recording the safety sign-off without auto-disbursing funds—ensuring capital is never transferred without dedicated dual authorization.',
    action: async (send, wait) => {
      // Navigate to Approvals Queue
      await send('Runtime.evaluate', {
        expression: `
          const appTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approvals') || b.textContent.includes('Queue'));
          if (appTab) appTab.click();
        `
      });
      await wait(2500);
    }
  },
  {
    id: 'scene6_settings_closing',
    title: 'Verified Live Intelligence & Provenance Gating',
    text: 'PayPilot AI features autonomous customer memory, verified live Google Gemini AI reasoning, and direct PayPal Sandbox integration. It is more than a chatbot—it is an intelligent action agent completing the commerce loop. Thank you.',
    action: async (send, wait) => {
      // Navigate to Settings
      await send('Runtime.evaluate', {
        expression: `
          const setTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Settings'));
          if (setTab) setTab.click();
        `
      });
      await wait(2500);
    }
  }
];

async function main() {
  console.log('=== PayPilot AI Demo Video Pipeline ===');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1. Generate Voiceover Audio Files
  console.log('\n[1/4] Generating AI Voiceover Tracks with Gemini TTS...');
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
    // Get audio duration
    const durStr = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mp3Path}"`).toString().trim();
    scene.duration = parseFloat(durStr);
    console.log(`✓ ${scene.id}: ${scene.duration.toFixed(2)}s`);
  }

  // 2. Start Chrome Headless & Capture UI Visuals
  console.log('\n[2/4] Capturing 1080p Screen Renderings via Chrome CDP...');
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

  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    console.log(`Rendering visual for ${scene.id}...`);
    await scene.action(send, wait);
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

    // Create video with pan/zoom + audio
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

  const finalDur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${finalVideoPath}"`).toString().trim();
  const finalSize = (fs.statSync(finalVideoPath).size / (1024 * 1024)).toFixed(2);

  console.log('\n======================================================');
  console.log(` SUCCESS! Demo Video Generated: ${finalVideoPath}`);
  console.log(` Total Duration: ${parseFloat(finalDur).toFixed(1)} seconds (${(parseFloat(finalDur) / 60).toFixed(2)} min)`);
  console.log(` File Size: ${finalSize} MB`);
  console.log(` Complies with Hackathon < 3 minute rule: ${parseFloat(finalDur) < 180 ? 'YES' : 'NO'}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('Video generation error:', err);
  process.exit(1);
});
