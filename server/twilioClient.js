const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

function isTwilioConfigured() {
  return Boolean(
    accountSid &&
    accountSid.startsWith('AC') &&
    accountSid !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' &&
    authToken &&
    authToken !== 'your_auth_token_here'
  );
}

const twilioClient = isTwilioConfigured() ? require('twilio')(accountSid, authToken) : null;

module.exports = { twilioClient, isTwilioConfigured };
