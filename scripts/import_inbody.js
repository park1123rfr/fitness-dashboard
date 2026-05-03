const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'inbody_import.csv');
const JSON_PATH = path.join(__dirname, '..', 'data', 'inbody.json');

// YYYYMMDDHHmmss → YYYY-MM-DD
function parseDate(raw) {
  const s = String(raw).replace(/\D/g, '');
  if (s.length < 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// "-" 또는 빈값 → null
function toNum(val) {
  if (val === undefined || val === null) return null;
  const t = String(val).trim();
  if (!t || t === '-') return null;
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

function findIdx(headers, predicate) {
  return headers.findIndex(predicate);
}

function parseCSV(text) {
  // BOM 제거
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());

  const idx = {
    date:               findIdx(headers, (h) => h === '날짜'),
    weight:             findIdx(headers, (h) => h === '체중(kg)'),
    muscle_mass:        findIdx(headers, (h) => h === '골격근량(kg)'),
    fat_mass:           findIdx(headers, (h) => h === '체지방량(kg)'),
    bmi:                findIdx(headers, (h) => h.startsWith('BMI')),
    body_fat_percent:   findIdx(headers, (h) => h === '체지방률(%)'),
    bmr:                findIdx(headers, (h) => h.startsWith('기초대사량')),
    inbody_score:       findIdx(headers, (h) => h === '인바디점수'),
    visceral_fat_level: findIdx(headers, (h) => h.includes('내장지방')),
  };

  if (idx.date === -1) {
    console.error('날짜 컬럼을 찾을 수 없습니다. 헤더:', headers.join(', '));
    return [];
  }

  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      const date = parseDate(cols[idx.date]);
      if (!date) return null;

      const get = (i) => (i !== -1 ? cols[i] : null);
      return {
        date,
        weight:             toNum(get(idx.weight)),
        muscle_mass:        toNum(get(idx.muscle_mass)),
        fat_mass:           toNum(get(idx.fat_mass)),
        bmi:                toNum(get(idx.bmi)),
        body_fat_percent:   toNum(get(idx.body_fat_percent)),
        bmr:                toNum(get(idx.bmr)),
        inbody_score:       toNum(get(idx.inbody_score)),
        visceral_fat_level: toNum(get(idx.visceral_fat_level)),
      };
    })
    .filter(Boolean);
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.log('data/inbody_import.csv not found. Skipping.');
    return;
  }

  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));
  if (!rows.length) {
    console.log('CSV에 유효한 데이터가 없습니다. Skipping.');
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
    data.measurements.push(row);
    existingDates.add(row.date);
    console.log(`  added: ${row.date}  체중 ${row.weight}kg  골격근량 ${row.muscle_mass}kg  체지방률 ${row.body_fat_percent}%`);
    added++;
  }

  data.measurements.sort((a, b) => (a.date > b.date ? 1 : -1));
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
  console.log(`완료. ${added}건 추가 (누적 ${data.measurements.length}건)`);
}

main();
