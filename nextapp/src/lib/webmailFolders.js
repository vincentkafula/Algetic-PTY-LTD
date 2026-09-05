// ---------------------------------------------------------------------------
// Shared by the webmail messages Route Handlers — split apart by Next.js's
// file-based routing, unlike Express where these lived in one
// routes/webmail.js and could share local functions directly.
//
// FOLDERS: Inbox, Sent, Spam, Trash are all real, user-driven states on a
// message record (`folder` field) — moving something to Spam or Trash is a
// person clicking a button, not automated spam detection.
// ---------------------------------------------------------------------------

const VALID_FOLDERS = ['inbox', 'sent', 'spam', 'trash'];

function effectiveFolder(msg) {
  // Legacy records (created before this feature existed) have no folder
  // field — fall back to a reasonable default based on direction so old
  // messages still show up somewhere sensible instead of vanishing.
  return msg.folder || (msg.direction === 'inbound' ? 'inbox' : 'sent');
}

module.exports = { VALID_FOLDERS, effectiveFolder };
