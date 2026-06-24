const { authenticator } = require('otplib');

/**
 * Generates the current 6-digit TOTP code from the secret a user obtained
 * once from smartapi.angelbroking.com/enable-totp.
 * This is what lets the bot log in without a human typing a fresh code every time.
 */
function generateTotp(totpSecret) {
  if (!totpSecret) {
    throw new Error('TOTP secret is required to generate a login code');
  }
  // Angel One issues standard base32 TOTP secrets (30s step, 6 digits, SHA1) -
  // the otplib defaults already match that, so no extra options are needed.
  return authenticator.generate(totpSecret.replace(/\s+/g, ''));
}

module.exports = { generateTotp };
