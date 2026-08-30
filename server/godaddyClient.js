const GODADDY_PAT = process.env.GODADDY_PAT;
const GODADDY_BASE_URL = 'https://api.godaddy.com/v3';

function isGoDaddyConfigured() {
  return Boolean(GODADDY_PAT && GODADDY_PAT !== 'your_godaddy_personal_access_token_here');
}

function authHeader() {
  return `Bearer ${GODADDY_PAT}`;
}

module.exports = { GODADDY_BASE_URL, isGoDaddyConfigured, authHeader };
