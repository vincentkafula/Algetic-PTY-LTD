const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Lightweight JSON-file persistence — ported from the Express version
// (server/db.js) with one real adaptation, not a blind copy-paste: the
// original used `path.join(__dirname, 'data')`, which assumes the file's
// own location in the source tree. Next.js's build/bundling (especially
// `output: 'standalone'`, which traces and copies only the files a route
// actually needs into a new `.next/standalone` directory) can change WHERE
// this file physically ends up at runtime, silently breaking a __dirname-
// relative path. `process.cwd()` — the process's working directory at
// startup, which `next start` sets to the project root regardless of
// bundling mode — is the stable reference point instead.
//
// For real production use, swap this module for Postgres/MySQL — the shape
// of the functions below (getAll/find/insert/update/remove per collection)
// maps directly onto a proper ORM/query layer, so callers in the API routes
// don't need to change.
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  users: [],
  mailboxes: [],
  numbers: [],
  trunks: [],
  messages: [],
  ivrMenus: [],
  callQueues: [],
  callAgents: [],
  domains: [],
  projects: [],
  sipDomains: [],
  orders: []
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
    console.error('altegic db: failed to read data file, starting empty store:', err.message);
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
  callAgents: collection('callAgents'),
  domains: collection('domains'),
  projects: collection('projects'),
  sipDomains: collection('sipDomains'),
  orders: collection('orders')
};
