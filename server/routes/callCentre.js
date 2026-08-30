const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { twilioClient, isTwilioConfigured } = require('../twilioClient');
const { PUBLIC_BASE_URL } = require('../mailgunClient'); // shared env var, not Mailgun-specific

// ---------------------------------------------------------------------------
// Call centre: IVR menus, queues, and agents, scoped per Altegic account
// (unlike the private SIP network, this one DOES follow the normal
// per-account isolation every other Altegic resource uses).
//
// IMPORTANT — how this relates to the SIP trunk feature: a Twilio phone
// number can be attached to a SIP trunk (for direct-dial IP phones, see
// services/trunking.js) OR configured with a Voice URL webhook (for IVR/
// queue routing, here) — Twilio only honors one at a time; attaching a
// number to a trunk makes it ignore that number's own Voice URL entirely.
// Assigning a number to an IVR menu below therefore detaches it from any
// trunk it was on. Numbers can't do both jobs simultaneously.
// ---------------------------------------------------------------------------

router.use(requireAuth);

function isConfigured() {
  return isTwilioConfigured() && Boolean(PUBLIC_BASE_URL);
}

// ===== IVR menus =====

/**
 * GET /api/call-centre/menus
 */
router.get('/menus', (req, res) => {
  const menus = db.ivrMenus.filter((m) => m.ownerId === req.user.id);
  res.json({ menus });
});

/**
 * POST /api/call-centre/menus
 * body: { name, greeting, options: [{ digit, action, target }] }
 * action is one of: "dial" (target = phone number), "queue" (target =
 * queue id), "menu" (target = another menu id, for submenus), "hangup"
 * (target = optional closing message).
 */
router.post('/menus', async (req, res) => {
  const { name, greeting, options } = req.body || {};
  if (!name || !greeting) return res.status(400).json({ error: 'name and greeting are required' });
  if (!Array.isArray(options) || options.length === 0) {
    return res.status(400).json({ error: 'At least one option is required' });
  }
  for (const opt of options) {
    if (!/^[0-9*#]$/.test(opt.digit)) {
      return res.status(400).json({ error: `"${opt.digit}" is not a valid single touch-tone digit (0-9, *, #)` });
    }
    if (!['dial', 'queue', 'menu', 'hangup'].includes(opt.action)) {
      return res.status(400).json({ error: `"${opt.action}" is not a valid action` });
    }
  }

  const record = {
    id: crypto.randomUUID(),
    ownerId: req.user.id,
    name,
    greeting,
    options,
    createdAt: new Date().toISOString()
  };
  await db.ivrMenus.insert(record);
  res.status(201).json(record);
});

/**
 * DELETE /api/call-centre/menus/:id
 */
router.delete('/menus/:id', async (req, res) => {
  const menu = db.ivrMenus.find((m) => m.id === req.params.id && m.ownerId === req.user.id);
  if (!menu) return res.status(404).json({ error: 'Menu not found' });

  const inUse = db.numbers.find((n) => n.ownerId === req.user.id && n.callCentreMenuId === menu.id);
  if (inUse) {
    return res.status(409).json({ error: `${inUse.phoneNumber} is still assigned to this menu — unassign it first` });
  }

  await db.ivrMenus.remove((m) => m.id === menu.id);
  res.status(204).end();
});

// ===== Queues =====

/**
 * GET /api/call-centre/queues
 */
router.get('/queues', (req, res) => {
  const queues = db.callQueues.filter((q) => q.ownerId === req.user.id);
  res.json({ queues });
});

/**
 * POST /api/call-centre/queues
 * body: { name }
 * Creates both the local record and the actual Twilio Queue resource —
 * <Enqueue>/<Dial><Queue> address queues by name, so the Twilio-side queue
 * has to exist (Twilio creates it lazily on first use in some setups, but
 * creating it explicitly here means it shows up in the Twilio console
 * immediately, which makes debugging a lot less confusing).
 */
router.post('/queues', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / PUBLIC_BASE_URL in .env' });
  }

  // Twilio queue names are scoped per account, so prefix with the Altegic
  // account id to avoid two different Altegic customers' queues colliding
  // inside the same Twilio account.
  const twilioQueueName = `${req.user.id}-${name}`.slice(0, 64);

  try {
    const queue = await twilioClient.queues.create({ friendlyName: twilioQueueName, maxSize: 100 });
    const record = {
      id: crypto.randomUUID(),
      ownerId: req.user.id,
      name,
      twilioQueueSid: queue.sid,
      twilioQueueName,
      createdAt: new Date().toISOString()
    };
    await db.callQueues.insert(record);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/call-centre/queues/:id/status
 * Live queue depth from Twilio — how many callers are currently waiting.
 */
router.get('/queues/:id/status', async (req, res) => {
  const queue = db.callQueues.find((q) => q.id === req.params.id && q.ownerId === req.user.id);
  if (!queue) return res.status(404).json({ error: 'Queue not found' });
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration in .env' });
  }
  try {
    const twilioQueue = await twilioClient.queues(queue.twilioQueueSid).fetch();
    res.json({ currentSize: twilioQueue.currentSize, averageWaitTime: twilioQueue.averageWaitTime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/call-centre/queues/:id
 */
router.delete('/queues/:id', async (req, res) => {
  const queue = db.callQueues.find((q) => q.id === req.params.id && q.ownerId === req.user.id);
  if (!queue) return res.status(404).json({ error: 'Queue not found' });

  const inUse = db.ivrMenus.find((m) => m.ownerId === req.user.id && (m.options || []).some((o) => o.action === 'queue' && o.target === queue.id));
  if (inUse) {
    return res.status(409).json({ error: `Menu "${inUse.name}" still routes to this queue — update or delete that menu first` });
  }

  try {
    if (isConfigured() && queue.twilioQueueSid) {
      await twilioClient.queues(queue.twilioQueueSid).remove();
    }
  } catch (err) {
    console.error('Failed to delete Twilio queue:', err.message);
  }
  await db.callQueues.remove((q) => q.id === queue.id);
  res.status(204).end();
});

// ===== Agents =====

/**
 * GET /api/call-centre/agents
 */
router.get('/agents', (req, res) => {
  const agents = db.callAgents.filter((a) => a.ownerId === req.user.id);
  res.json({ agents });
});

/**
 * POST /api/call-centre/agents
 * body: { name, phoneNumber, queueId }
 * phoneNumber is whatever number Twilio should ring to reach this agent —
 * their cell, a desk phone, or a number on the private SIP network (if
 * that's been set up to accept inbound PSTN-style calls some other way;
 * by default the private SIP network has no PSTN connectivity — see its
 * README — so a private-SIP-network number only works here if you've
 * separately made it reachable, e.g. by dialing through the trunk system).
 */
router.post('/agents', async (req, res) => {
  const { name, phoneNumber, queueId } = req.body || {};
  if (!name || !phoneNumber || !queueId) {
    return res.status(400).json({ error: 'name, phoneNumber, and queueId are required' });
  }
  if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
    return res.status(400).json({ error: 'phoneNumber must be in E.164 format, e.g. +14155551234' });
  }
  const queue = db.callQueues.find((q) => q.id === queueId && q.ownerId === req.user.id);
  if (!queue) return res.status(400).json({ error: 'queueId does not match one of your queues' });

  const record = {
    id: crypto.randomUUID(),
    ownerId: req.user.id,
    name,
    phoneNumber,
    queueId,
    available: true,
    createdAt: new Date().toISOString()
  };
  await db.callAgents.insert(record);
  res.status(201).json(record);
});

/**
 * PATCH /api/call-centre/agents/:id/availability
 * body: { available: true|false }
 */
router.patch('/agents/:id/availability', async (req, res) => {
  const agent = db.callAgents.find((a) => a.id === req.params.id && a.ownerId === req.user.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const { available } = req.body || {};
  if (typeof available !== 'boolean') return res.status(400).json({ error: 'available must be true or false' });

  const updated = await db.callAgents.update((a) => a.id === agent.id, { available });
  res.json(updated);
});

/**
 * DELETE /api/call-centre/agents/:id
 */
router.delete('/agents/:id', async (req, res) => {
  const agent = db.callAgents.find((a) => a.id === req.params.id && a.ownerId === req.user.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  await db.callAgents.remove((a) => a.id === agent.id);
  res.status(204).end();
});

// ===== Assigning numbers to the call centre =====

/**
 * POST /api/call-centre/numbers/:numberId/assign
 * body: { menuId }
 * Points the number's Voice URL at this app's TwiML webhook and detaches
 * it from any SIP trunk it was on (see the module-level note on why those
 * two are mutually exclusive).
 */
router.post('/numbers/:numberId/assign', async (req, res) => {
  const number = db.numbers.find((n) => n.id === req.params.numberId && n.ownerId === req.user.id);
  if (!number) return res.status(404).json({ error: 'Number not found' });
  const { menuId } = req.body || {};
  const menu = db.ivrMenus.find((m) => m.id === menuId && m.ownerId === req.user.id);
  if (!menu) return res.status(400).json({ error: 'menuId does not match one of your menus' });
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration or PUBLIC_BASE_URL in .env' });
  }

  try {
    // Detach from the trunk first — a number can't be on a trunk AND have
    // its own Voice URL honored at the same time (see module note above).
    if (number.trunkId) {
      const trunk = db.trunks.find((t) => t.id === number.trunkId);
      if (trunk) {
        try {
          await twilioClient.trunking.v1.trunks(trunk.trunkSid).phoneNumbers(number.twilioSid).remove();
        } catch (err) {
          // Non-fatal — if it was already detached for some reason, continue.
          console.error('Failed to detach number from trunk before call-centre assignment:', err.message);
        }
      }
    }

    const voiceUrl = `${PUBLIC_BASE_URL}/api/webhooks/twilio/voice?menuId=${menu.id}`;
    await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl, voiceMethod: 'POST' });

    const updated = await db.numbers.update((n) => n.id === number.id, { callCentreMenuId: menu.id, trunkId: null });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/call-centre/numbers/:numberId/unassign
 * Clears the Voice URL. The number is left with no call handling at all
 * — re-provisioning trunk attachment is a separate step, not automatic,
 * since which trunk it should rejoin isn't unambiguous.
 */
router.post('/numbers/:numberId/unassign', async (req, res) => {
  const number = db.numbers.find((n) => n.id === req.params.numberId && n.ownerId === req.user.id);
  if (!number) return res.status(404).json({ error: 'Number not found' });
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Server is missing Twilio configuration in .env' });
  }

  try {
    await twilioClient.incomingPhoneNumbers(number.twilioSid).update({ voiceUrl: '' });
    const updated = await db.numbers.update((n) => n.id === number.id, { callCentreMenuId: null });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
