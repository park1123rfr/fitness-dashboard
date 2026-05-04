const https = require('https');
const fs = require('fs');
const path = require('path');

const HEVY_API_KEY = process.env.HEVY_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!HEVY_API_KEY) { console.error('HEVY_API_KEY is not set'); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY is not set'); process.exit(1); }

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      ...options,
    };
    const req = https.request(reqOptions, (res) => {
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
    if (body) req.write(body);
    req.end();
  });
}

async function fetchLatestWorkout() {
  const data = await httpsRequest(
    'https://api.hevyapp.com/v1/workouts?page=1&pageSize=1',
    { method: 'GET', headers: { 'api-key': HEVY_API_KEY, 'Content-Type': 'application/json' } }
  );
  return (data.workouts || [])[0] ?? null;
}

async function generateFeedback(workout) {
  const workoutText = JSON.stringify(workout, null, 2);
  const prompt = `다음 운동 기록을 분석해서 한국어로 피드백 해줘. 볼륨, 강도, 잘한 점, 개선점, 다음 운동 조언을 포함해줘: ${workoutText}`;

  const body = JSON.stringify({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const data = await httpsRequest(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    },
    body
  );
  return data.content?.[0]?.text ?? '';
}

async function main() {
  console.log('Fetching latest workout...');
  const workout = await fetchLatestWorkout();
  if (!workout) {
    console.log('No workouts found, skipping feedback generation.');
    return;
  }
  console.log(`Latest workout: ${workout.title} (${workout.start_time?.slice(0, 10)})`);

  console.log('Generating Claude feedback...');
  const feedback = await generateFeedback(workout);

  const feedbackPath = path.join(__dirname, '..', 'data', 'feedback.json');
  let existing = { feedbacks: [] };
  if (fs.existsSync(feedbackPath)) {
    try { existing = JSON.parse(fs.readFileSync(feedbackPath, 'utf8')); } catch {}
  }

  const entry = {
    date: workout.start_time?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    workout_title: workout.title ?? '운동',
    feedback,
    generated_at: new Date().toISOString(),
  };

  // Replace entry for the same workout date to avoid duplicates
  existing.feedbacks = existing.feedbacks.filter((f) => f.date !== entry.date);
  existing.feedbacks.unshift(entry);
  existing.feedbacks = existing.feedbacks.slice(0, 30);

  fs.writeFileSync(feedbackPath, JSON.stringify(existing, null, 2));
  console.log('Feedback saved to data/feedback.json');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
