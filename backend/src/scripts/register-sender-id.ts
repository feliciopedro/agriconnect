import * as https from 'https';

async function registerSenderId(apiKey: string, senderName: string, purpose: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://api.mnotify.com/api/senderid/register?key=${apiKey}`;
    
    const payload = JSON.stringify({
      sender_name: senderName,
      purpose: purpose
    });

    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve({ status: 'error', message: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  const apiKey = 'n2KEdiQig7Ru5OAOM7NRKNq7E';
  // Sender ID must be at most 11 characters
  const senderName = 'AgriConnect'; 
  const purpose = 'Transactional notifications for farmer produce listings, delivery updates, and buyer orders.';

  console.log(`Sending Sender ID registration request for "${senderName}" to mNotify...`);
  try {
    const response = await registerSenderId(apiKey, senderName, purpose);
    console.log('mNotify Response:', response);
  } catch (error) {
    console.error('Registration failed:', error);
  }
}

run();
