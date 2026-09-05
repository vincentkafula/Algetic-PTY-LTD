import { NextResponse } from 'next/server';

const db = require('@/lib/db');
const { requireMailboxAuth } = require('@/lib/mailboxAuth');
const { VALID_FOLDERS, effectiveFolder } = require('@/lib/webmailFolders');
const { withSanitizedErrors } = require('@/lib/sanitizeError');

/**
 * GET /api/webmail/messages?folder=inbox
 * folder is one of inbox|sent|spam|trash|starred. "starred" is virtual —
 * it shows every starred message regardless of which folder it's
 * actually filed in, same as Gmail.
 */
async function GET_impl(request) {
  let mailbox;
  try {
    mailbox = requireMailboxAuth(request);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 401 });
  }

  const folder = request.nextUrl.searchParams.get('folder') || 'inbox';
  const all = db.messages.filter((m) => m.mailboxId === mailbox.id);

  let filtered;
  if (folder === 'starred') {
    filtered = all.filter((m) => m.starred);
  } else if (VALID_FOLDERS.includes(folder)) {
    filtered = all.filter((m) => effectiveFolder(m) === folder);
  } else {
    return NextResponse.json({ error: `folder must be one of: ${VALID_FOLDERS.join(', ')}, starred` }, { status: 400 });
  }

  filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({
    messages: filtered.map((m) => ({ ...m, folder: effectiveFolder(m) }))
  });
}
export const GET = withSanitizedErrors(GET_impl);
