const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// MVNO (Mobile Virtual Network Operator) operations dashboard.
//
// EVERYTHING HERE IS SIMULATED. There is no real telecom core network behind
// this — no real HLR/HSS, no real cell towers, no real subscribers. This
// mirrors the reference implementation at github.com/vincentkafula/
// VINK-GRUP-LIMITED, which runs the exact same NOC-style dashboard on
// generated demo data whenever its real backend isn't reachable — the
// difference here is there's no "real backend" to fall back FROM at all yet.
// Every response below is tagged `demo: true` specifically so the frontend
// can never accidentally present this as live network data, and every
// number is generated fresh from a seed rather than stored, so nothing
// here can drift into looking like a persisted system of record.
//
// Building actual MVNO functionality — real subscriber provisioning, real
// billing, real fraud detection — requires a genuine MVNE/MNO wholesale
// relationship (spectrum access, HLR/HSS integration), which is a telecom
// licensing and commercial relationship, not something an API integration
// like Twilio's provides. See README for the same category of caveat
// already documented for the private SIP network and domain registration
// features.
// ---------------------------------------------------------------------------

router.use(requireAuth);

// Small seeded PRNG (mulberry32) so a given account sees stable-ish numbers
// across page loads within the same day, rather than wildly different
// values on every refresh — purely a demo-UX nicety, not meant to imply
// persistence.
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

/**
 * GET /api/mvno/kpis
 */
router.get('/kpis', (req, res) => {
  const r = makeRng(req.user.id);
  const totalSubscribers = r.int(180000, 260000);
  res.json({
    demo: true,
    data: {
      timestamp: new Date().toISOString(),
      totalSubscribers,
      activeSubscribers: Math.round(totalSubscribers * r.float(0.72, 0.85, 2)),
      networkUptimePct: r.float(99.90, 99.99, 2),
      activeDataSessions: r.int(80000, 140000),
      activeVoiceCalls: r.int(2000, 6000),
      smsQueueDepth: r.int(50, 400),
      revenueTodayZAR: r.int(180000, 320000),
      fraudAlertsActive: r.int(2, 18),
      avgNetworkLoadPct: r.int(45, 82),
      totalTowerCount: 24,
      towersOnline: r.int(21, 24),
      activeSims: totalSubscribers,
      openTickets: r.int(80, 260),
      roamingUsers: r.int(400, 2200),
      dataThroughputGbps: r.float(4.5, 12.0, 1)
    }
  });
});

/**
 * GET /api/mvno/towers
 */
router.get('/towers', (req, res) => {
  const r = makeRng(req.user.id + ':towers');
  const towers = Array.from({ length: 24 }, (_, i) => {
    const roll = i % 15;
    const status = roll === 0 ? 'offline' : roll === 7 ? 'warning' : 'online';
    return {
      id: `TWR-${String(i + 1).padStart(4, '0')}`,
      name: `Tower ${i + 1}`,
      region: REGIONS[i % REGIONS.length],
      technology: TECH[i % TECH.length],
      status,
      loadPercent: r.int(18, 96),
      connectedSubscribers: r.int(40, 780)
    };
  });
  res.json({ demo: true, data: towers });
});

/**
 * GET /api/mvno/subscribers
 * A sample page, not a full subscriber base — this is a demo, not a real
 * customer database.
 */
router.get('/subscribers', (req, res) => {
  const r = makeRng(req.user.id + ':subs');
  const statuses = ['active', 'active', 'active', 'suspended', 'porting'];
  const plans = ['Prepaid 5GB', 'Prepaid 20GB', 'Postpaid 50GB', 'Postpaid Unlimited'];
  const subscribers = Array.from({ length: 15 }, (_, i) => ({
    msisdn: `+27${r.int(60, 84)}${String(r.int(1000000, 9999999))}`,
    status: statuses[i % statuses.length],
    plan: plans[i % plans.length],
    dataBalanceMB: r.int(0, 20000),
    homeNetwork: 'ZA-DEMO',
    roaming: r.int(0, 9) === 0
  }));
  res.json({ demo: true, data: subscribers });
});

/**
 * GET /api/mvno/fraud-alerts
 */
router.get('/fraud-alerts', (req, res) => {
  const r = makeRng(req.user.id + ':fraud');
  const types = ['sim_swap', 'roaming_abuse', 'premium_rate', 'cloning', 'bypass'];
  const severities = ['critical', 'warning', 'info'];
  const alerts = Array.from({ length: 8 }, (_, i) => ({
    id: `FRD-${String(i + 1).padStart(3, '0')}`,
    type: types[i % types.length],
    severity: severities[i % severities.length],
    msisdn: `+27${r.int(60, 84)}${String(r.int(1000000, 9999999))}`,
    riskScore: r.float(1, 10, 1),
    detectedAt: new Date(Date.now() - r.int(1, 720) * 60000).toISOString()
  }));
  res.json({ demo: true, data: alerts });
});

/**
 * GET /api/mvno/billing-summary
 */
router.get('/billing-summary', (req, res) => {
  const r = makeRng(req.user.id + ':billing');
  res.json({
    demo: true,
    data: {
      revenueTodayZAR: r.int(180000, 320000),
      revenueMTDZAR: r.int(3800000, 6200000),
      invoicesOverdue: r.int(20, 180),
      invoicesPaid: r.int(4000, 9000),
      avgRevenuePerUserZAR: r.float(85, 240, 2)
    }
  });
});

/**
 * GET /api/mvno/support-summary
 */
router.get('/support-summary', (req, res) => {
  const r = makeRng(req.user.id + ':support');
  res.json({
    demo: true,
    data: {
      openTickets: r.int(80, 260),
      avgResolutionHours: r.float(2, 18, 1),
      csatScore: r.float(3.6, 4.8, 1),
      categories: {
        billing: r.int(20, 80),
        technical: r.int(30, 100),
        porting: r.int(5, 30),
        activation: r.int(10, 40),
        roaming: r.int(2, 15),
        fraud: r.int(1, 10)
      }
    }
  });
});

/**
 * GET /api/mvno/roaming
 */
router.get('/roaming', (req, res) => {
  const r = makeRng(req.user.id + ':roaming');
  const partners = ['Vodafone UK', 'AT&T', 'Deutsche Telekom', 'Telstra', 'Orange France', 'MTN Nigeria'];
  const data = partners.map((networkName, i) => ({
    networkName,
    country: ['United Kingdom', 'United States', 'Germany', 'Australia', 'France', 'Nigeria'][i],
    status: i === 5 ? 'restricted' : 'active',
    activeRoamers: r.int(50, 900),
    revenue30dUSD: r.int(2000, 45000)
  }));
  res.json({ demo: true, data });
});

module.exports = router;
