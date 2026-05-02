const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.HEVY_API_KEY;
if (!API_KEY) {
  console.error('HEVY_API_KEY environment variable is not set');
  process.exit(1);
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'api-key': API_KEY, 'Content-Type': 'application/json', ...headers },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchAllWorkouts() {
  let allWorkouts = [];
  let page = 1;
  const pageSize = 10;

  while (true) {
    console.log(`Fetching page ${page}...`);
    const res = await httpsGet(
      `https://api.hevyapp.com/v1/workouts?page=${page}&pageSize=${pageSize}`
    );
    const workouts = res.workouts || [];
    allWorkouts = allWorkouts.concat(workouts);

    const pageCount = res.page_count || 1;
    if (page >= pageCount || workouts.length === 0) break;
    page++;
    // Rate limit safety
    await new Promise((r) => setTimeout(r, 200));
  }

  return allWorkouts;
}

async function main() {
  try {
    console.log('Fetching workouts from Hevy API...');
    const workouts = await fetchAllWorkouts();

    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const output = {
      updated_at: new Date().toISOString(),
      total: workouts.length,
      workouts,
    };

    fs.writeFileSync(path.join(dataDir, 'workouts.json'), JSON.stringify(output, null, 2));
    console.log(`Done. Saved ${workouts.length} workouts.`);
  } catch (err) {
    console.error('Failed to fetch workouts:', err.message);
    process.exit(1);
  }
}

main();
