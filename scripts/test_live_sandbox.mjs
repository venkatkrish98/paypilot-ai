import fs from 'node:fs';

// Load .env
if (fs.existsSync('.env')) {
  const envText = fs.readFileSync('.env', 'utf-8');
  for (const line of envText.split('\n')) {
    const parts = line.trim().split('=');
    if (parts.length >= 2 && !parts[0].startsWith('#')) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('ERROR: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

async function verifyPayPalSandbox() {
  console.log('1. Authenticating against https://api-m.sandbox.paypal.com/v1/oauth2/token...');
  const authRes = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!authRes.ok) {
    throw new Error(`Authentication failed: ${authRes.status} ${await authRes.text()}`);
  }

  const authData = await authRes.json();
  const token = authData.access_token;
  console.log(' OAuth 2.0 Token acquired successfully. Token scope:', authData.scope);

  console.log('2. Creating test Orders v2 order ($12.00 USD)...');
  const orderRes = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: 'paypilot-sandbox-test',
        amount: { currency_code: 'USD', value: '12.00' }
      }]
    })
  });

  const orderData = await orderRes.json();
  console.log(' Order created:', orderData.id, '| Status:', orderData.status);
  console.log(' Approve Link:', orderData.links?.find(l => l.rel === 'approve')?.href);
  console.log('\nPayPal Sandbox REST API verification passed!');
}

verifyPayPalSandbox().catch(console.error);
