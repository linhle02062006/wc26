const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'data', 'worldcup-2026-schedule.json');
const dstFile = path.join(__dirname, 'data', 'worldcup-matches.json');

const raw = fs.readFileSync(srcFile, 'utf8');
const matches = JSON.parse(raw);

const mapped = matches.map(m => {
  const dateUtc = new Date(m.dateEt).toISOString();
  
  return {
    ...m,
    dateUtc: dateUtc,
    statusShort: 'NS',
    home: {
      ...m.home,
      logo: m.home.flag || null
    },
    away: {
      ...m.away,
      logo: m.away.flag || null
    }
  };
});

const cacheData = {
  lastSyncAt: new Date().toISOString(),
  source: 'official-import',
  data: mapped
};

fs.writeFileSync(dstFile, JSON.stringify(cacheData, null, 2), 'utf8');
console.log('Imported', mapped.length, 'matches successfully.');
