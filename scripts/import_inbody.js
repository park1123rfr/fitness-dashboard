const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'inbody_import.csv');
const JSON_PATH = path.join(__dirname, '..', 'data', 'inbody.json');

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      return obj;
    })
    .filter((row) => row.date);
}

function toNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.log('data/inbody_import.csv not found. Skipping.');
    return;
  }

  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));
  if (!rows.length) {
    console.log('CSV has no data rows. Skipping.');
    return;
  }

  let data = { measurements: [] };
  if (fs.existsSync(JSON_PATH)) {
    data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  }

  const existingDates = new Set(data.measurements.map((m) => m.date));
  let added = 0;

  for (const row of rows) {
    if (existingDates.has(row.date)) {
      console.log(`  skip (duplicate): ${row.date}`);
      continue;
    }
    data.measurements.push({
      date: row.date,
      weight: toNum(row.weight),
      body_fat_percent: toNum(row.body_fat_percent),
      muscle_mass: toNum(row.muscle_mass),
      body_fat_mass: toNum(row.body_fat_mass),
      bmi: toNum(row.bmi),
    });
    existingDates.add(row.date);
    console.log(`  added: ${row.date}`);
    added++;
  }

  data.measurements.sort((a, b) => (a.date > b.date ? 1 : -1));
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
  console.log(`Done. Added ${added} new measurement(s).`);
}

main();
