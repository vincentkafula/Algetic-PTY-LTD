const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Lightweight JSON-file persistence.
//
// This keeps the starter dependency-free (no native builds, no external
// database to stand up) while fixing the biggest gap in the original demo:
// data no longer disappears every time the server restarts.
//
// For real production use, swap this module for Postgres/MySQL — the shape
// of the functions below (getAll/find/insert/update/remove per collection)
// maps directly onto a proper ORM/query layer, so callers in routes/ don't
// need to change.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  users: [],
  mailboxes: [],
  numbers: [],
  trunks: [],
  messages: [],
  ivrMenus: [],
  callQueues: [],
  callAgents: []
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function readAll() {
  ensureStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch (err) {
    // Corrupt or empty file — don't crash the server, start fresh in memory
    // (existing file is left on disk in case someone wants to inspect it).
    console.error('commhub db: failed to read data file, starting empty store:', err.message);
    return { ...DEFAULT_DATA };
  }
}

// Simple write queue so concurrent requests can't interleave writes and
// corrupt the file (this is a JSON file, not a real transactional DB).
let writeQueue = Promise.resolve();
function writeAll(data) {
  writeQueue = writeQueue.then(
    () => fs.promises.writeFile(DATA_FILE, JSON.stringify(data, null, 2)),
    () => fs.promises.writeFile(DATA_FILE, JSON.stringify(data, null, 2))
  );
  return writeQueue;
}

function collection(name) {
  return {
    all() {
      return readAll()[name];
    },
    find(predicate) {
      return readAll()[name].find(predicate);
    },
    filter(predicate) {
      return readAll()[name].filter(predicate);
    },
    async insert(record) {
      const data = readAll();
      data[name].push(record);
      await writeAll(data);
      return record;
    },
    async remove(predicate) {
      const data = readAll();
      const before = data[name].length;
      data[name] = data[name].filter((r) => !predicate(r));
      const removed = before !== data[name].length;
      if (removed) await writeAll(data);
      return removed;
    },
    async update(predicate, updates) {
      const data = readAll();
      let updated = null;
      data[name] = data[name].map((r) => {
        if (predicate(r)) {
          updated = { ...r, ...updates };
          return updated;
        }
        return r;
      });
      if (updated) await writeAll(data);
      return updated;
    }
  };
}

module.exports = {
  users: collection('users'),
  mailboxes: collection('mailboxes'),
  numbers: collection('numbers'),
  trunks: collection('trunks'),
  messages: collection('messages'),
  ivrMenus: collection('ivrMenus'),
  callQueues: collection('callQueues'),
  callAgents: collection('callAgents')
};
