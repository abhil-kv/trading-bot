const axios = require('axios');

let cachedPublicIp = null;
let cachedAt = 0;

/**
 * Angel One's API asks for the caller's public IP on every request.
 * We resolve it once and cache it for an hour; if the lookup ever fails
 * (e.g. no outbound internet to the IP lookup service) we fall back to a
 * placeholder - Angel One does not appear to hard-reject login over this,
 * but real values are recommended.
 */
async function getPublicIp() {
  const ONE_HOUR = 60 * 60 * 1000;
  if (cachedPublicIp && Date.now() - cachedAt < ONE_HOUR) {
    return cachedPublicIp;
  }
  try {
    const { data } = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
    cachedPublicIp = data.ip;
    cachedAt = Date.now();
    return cachedPublicIp;
  } catch (err) {
    return '106.51.74.45'; // harmless placeholder fallback
  }
}

async function buildAngelHeaders({ apiKey, jwtToken } = {}) {
  const publicIp = await getPublicIp();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': publicIp,
    'X-MACAddress': 'fe:ff:ff:ff:ff:ff',
    'X-PrivateKey': apiKey,
  };
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }
  return headers;
}

module.exports = { buildAngelHeaders, getPublicIp };
