require('dotenv').config();

const developmentMode = process.env.DEVELOPMENT_MODE;
const isDevelopment = developmentMode === 'development';

module.exports = {
  port: process.env.PORT || 4000,
  clientOrigin: isDevelopment
    ? 'http://localhost:5173'
    : process.env.CLIENT_ORIGIN,
  disableCorsForLocalhost5173: isDevelopment,
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  defaultLogin: {
    clientId: process.env.CLIENT_ID || '',
    pin: process.env.PIN || '',
    totpSecret: process.env.TOTP_SECRET || '',
    apiKey: process.env.API_KEY || '',
    apiSecret: process.env.API_SECRET || '',
  },
  instrumentMasterTtlMs: Number(process.env.INSTRUMENT_MASTER_TTL_MS || 24 * 60 * 60 * 1000),
  quoteCacheTtlMs: Number(process.env.QUOTE_CACHE_TTL_MS || 3000),

  angel: {
    baseUrl: 'https://apiconnect.angelone.in',
    loginPath: '/rest/auth/angelbroking/user/v1/loginByPassword',
    generateTokensPath: '/rest/auth/angelbroking/jwt/v1/generateTokens',
    logoutPath: '/rest/secure/angelbroking/user/v1/logout',
    quotePath: '/rest/secure/angelbroking/market/v1/quote/',
    scripMasterUrl: 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json',
  },
};
