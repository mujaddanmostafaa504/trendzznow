'use strict';
// Very small JSON file database. Everything lives in memory and is written to
// data/db.json (atomic write + one daily backup). Good for a small shop.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const BACKUPS = path.join(DATA_DIR, 'backups');

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(BACKUPS, { recursive: true });

let data = null;
let timer = null;
let dirty = false;
let lastBackupDay = '';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function load() {
  if (fs.existsSync(FILE)) {
    try {
      data = readJson(FILE);
      return data;
    } catch (e) {
      console.error('[db] db.json corrupted:', e.message);
      try {
        fs.renameSync(FILE, path.join(DATA_DIR, `db.corrupt-${Date.now()}.json`));
      } catch (e2) {
        /* ignore */
      }
      const backups = fs.readdirSync(BACKUPS).filter((f) => f.endsWith('.json')).sort().reverse();
      for (const b of backups) {
        try {
          data = readJson(path.join(BACKUPS, b));
          console.error('[db] restored from backup', b);
          return data;
        } catch (e3) {
          /* try next */
        }
      }
    }
  }
  data = null;
  return null;
}

function flush() {
  timer = null;
  if (!dirty || !data) return;
  dirty = false;
  const tmp = FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
    const day = new Date().toISOString().slice(0, 10);
    if (day !== lastBackupDay) {
      lastBackupDay = day;
      fs.copyFileSync(FILE, path.join(BACKUPS, `db-${day}.json`));
      const old = fs.readdirSync(BACKUPS).filter((f) => /^db-.*\.json$/.test(f)).sort().reverse().slice(14);
      old.forEach((f) => {
        try {
          fs.unlinkSync(path.join(BACKUPS, f));
        } catch (e) {
          /* ignore */
        }
      });
    }
  } catch (e) {
    console.error('[db] save failed:', e.message);
    dirty = true;
  }
}

function save() {
  dirty = true;
  if (!timer) timer = setTimeout(flush, 250);
}

function saveNow() {
  dirty = true;
  if (timer) clearTimeout(timer);
  flush();
}

function init(initial) {
  if (!load()) {
    data = initial;
    saveNow();
  }
  return data;
}

function nextSeq(name, start = 1000) {
  data.meta.seq = data.meta.seq || {};
  data.meta.seq[name] = (data.meta.seq[name] || start) + 1;
  return data.meta.seq[name];
}

function shutdown() {
  saveNow();
}
process.on('exit', shutdown);
['SIGINT', 'SIGTERM'].forEach((sig) =>
  process.on(sig, () => {
    shutdown();
    process.exit(0);
  })
);

module.exports = {
  init,
  save,
  saveNow,
  nextSeq,
  get data() {
    return data;
  },
  set data(v) {
    data = v;
  },
  DATA_DIR,
  UPLOADS,
  FILE,
};
