// ---------------------------------------------------------------------------
// Ported from server/routes/mvno.js. Shared by all 7 MVNO Route Handlers
// — split apart by Next.js's file-based routing, unlike Express where
// these all lived in one routes/mvno.js and could share local functions
// directly.
//
// EVERYTHING HERE IS SIMULATED. There is no real telecom core network
// behind this — no real HLR/HSS, no real cell towers, no real subscribers.
// Every response is tagged `demo: true` specifically so the frontend can
// never accidentally present this as live network data, and every number
// is generated fresh from a seed rather than stored, so nothing here can
// drift into looking like a persisted system of record.
//
// Building actual MVNO functionality — real subscriber provisioning, real
// billing, real fraud detection — requires a genuine MVNE/MNO wholesale
// relationship (spectrum access, HLR/HSS integration), a telecom
// licensing and commercial relationship, not something an API integration
// like Twilio's provides.
// ---------------------------------------------------------------------------

// Small seeded PRNG (mulberry32) so a given account sees stable-ish
// numbers across page loads within the same day, rather than wildly
// different values on every refresh — purely a demo-UX nicety, not meant
// to imply persistence.
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function makeRng(ownerId) {
  const dayKey = new Date().toISOString().slice(0, 10); // changes daily
  const rand = seedFromString(`${ownerId}:${dayKey}`);
  return {
    int: (min, max) => Math.floor(rand() * (max - min + 1)) + min,
    float: (min, max, digits = 1) => Number((rand() * (max - min) + min).toFixed(digits)),
    pick: (arr) => arr[Math.floor(rand() * arr.length)]
  };
}

const REGIONS = ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Limpopo', 'Eastern Cape', 'Free State'];
const TECH = ['4G', '4G', '4G', '5G', '3G'];

module.exports = { makeRng, REGIONS, TECH };
