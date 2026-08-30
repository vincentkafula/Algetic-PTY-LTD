const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ---------------------------------------------------------------------------
// Website and software development requests, tracked through a simple
// status pipeline: Requested -> In Progress -> Delivered (or Cancelled).
//
// There's no API that produces a website or custom software on demand —
// unlike domains/numbers/mailboxes, real delivery happens outside this
// platform (your own team does the actual work). This is honestly a
// lightweight project tracker, not a resold service, and is presented
// that way rather than pretending otherwise.
//
// SCOPING NOTE, same shape as the call centre and private SIP network
// features: this app has no staff/admin role distinct from a regular
// account, so any logged-in user can update any of their own project's
// status. If this needs to become "customers request, your team updates
// status," that's a role system to add on top of this, not a rebuild of
// it — the data model doesn't change, only who's allowed to call which
// endpoint.
// ---------------------------------------------------------------------------

const VALID_TYPES = ['website', 'software'];
const VALID_STATUSES = ['Requested', 'In Progress', 'Delivered', 'Cancelled'];

router.use(requireAuth);

/**
 * GET /api/projects
 */
router.get('/', (req, res) => {
  const projects = db.projects.filter((p) => p.ownerId === req.user.id);
  res.json({ projects });
});

/**
 * POST /api/projects
 * body: { type: "website"|"software", title, description, budget? }
 * budget is a free-text field (e.g. "R15,000" or "$2,000-3,000") — not
 * parsed or validated as a number, just carried through as the customer
 * wrote it.
 */
router.post('/', async (req, res) => {
  const { type, title, description, budget } = req.body || {};
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  const record = {
    id: crypto.randomUUID(),
    ownerId: req.user.id,
    type,
    title,
    description,
    budget: budget || null,
    status: 'Requested',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await db.projects.insert(record);
  res.status(201).json(record);
});

/**
 * PATCH /api/projects/:id/status
 * body: { status }
 */
router.patch('/:id/status', async (req, res) => {
  const project = db.projects.find((p) => p.id === req.params.id && p.ownerId === req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const updated = await db.projects.update((p) => p.id === project.id, { status, updatedAt: new Date().toISOString() });
  res.json(updated);
});

/**
 * DELETE /api/projects/:id
 */
router.delete('/:id', async (req, res) => {
  const project = db.projects.find((p) => p.id === req.params.id && p.ownerId === req.user.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  await db.projects.remove((p) => p.id === project.id);
  res.status(204).end();
});

module.exports = router;
