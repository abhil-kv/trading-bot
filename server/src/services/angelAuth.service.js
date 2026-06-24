const axios = require('axios');
const config = require('../config');
const { buildAngelHeaders } = require('../utils/angelHeaders');
const { generateTotp } = require('../utils/totp');

/**
 * Logs in to Angel One SmartAPI using clientcode + PIN + a freshly generated
 * TOTP code, exactly as described under "Login by Password" in the SmartAPI
 * docs: POST /rest/auth/angelbroking/user/v1/loginByPassword
 */
async function loginWithCredentials({ clientId, pin, totpSecret, apiKey }) {
  const totp = generateTotp(totpSecret);
  const headers = await buildAngelHeaders({ apiKey });
  const url = `${config.angel.baseUrl}${config.angel.loginPath}`;

  const { data } = await axios.post(
    url,
    { clientcode: clientId, password: pin, totp },
    { headers, timeout: 10000 }
  );

  if (!data || data.status !== true) {
    const message = (data && data.message) || 'Login failed';
    const error = new Error(message);
    error.angelErrorCode = data && data.errorcode;
    throw error;
  }

  return {
    jwtToken: data.data.jwtToken,
    refreshToken: data.data.refreshToken,
    feedToken: data.data.feedToken,
  };
}

/**
 * Exchanges a refresh token for a new JWT, without needing the PIN/TOTP
 * again. POST /rest/auth/angelbroking/jwt/v1/generateTokens
 */
async function refreshSession({ apiKey, jwtToken, refreshToken }) {
  const headers = await buildAngelHeaders({ apiKey, jwtToken });
  const url = `${config.angel.baseUrl}${config.angel.generateTokensPath}`;

  const { data } = await axios.post(url, { refreshToken }, { headers, timeout: 10000 });

  if (!data || data.status !== true) {
    const message = (data && data.message) || 'Token refresh failed';
    throw new Error(message);
  }

  return {
    jwtToken: data.data.jwtToken,
    refreshToken: data.data.refreshToken,
    feedToken: data.data.feedToken,
  };
}

/**
 * Refreshes the session; if the refresh token has also expired (sessions
 * die at midnight regardless), falls back to a full re-login using the
 * PIN + TOTP secret stashed in the user's server-side session.
 */
async function refreshOrRelogin(sessionAngel) {
  try {
    const refreshed = await refreshSession(sessionAngel);
    Object.assign(sessionAngel, refreshed);
    return sessionAngel;
  } catch (err) {
    const relogged = await loginWithCredentials(sessionAngel);
    Object.assign(sessionAngel, relogged);
    return sessionAngel;
  }
}

async function logout({ apiKey, jwtToken, clientId }) {
  const headers = await buildAngelHeaders({ apiKey, jwtToken });
  const url = `${config.angel.baseUrl}${config.angel.logoutPath}`;
  await axios.post(url, { clientcode: clientId }, { headers, timeout: 10000 });
}

module.exports = { loginWithCredentials, refreshSession, refreshOrRelogin, logout };
