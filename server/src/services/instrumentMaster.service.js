const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');
const NIFTY50 = require('../data/nifty50');

const CACHE_DIR = path.join(__dirname, '..', '..', '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'scripmaster.json');

let inMemoryMap = null; // Map<symbol, { token, name }>
let inMemoryLoadedAt = 0;

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

async function downloadScripMaster() {
  const { data } = await axios.get(config.angel.scripMasterUrl, {
    timeout: 30000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data;
}

function readCacheFromDisk() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  const stat = fs.statSync(CACHE_FILE);
  if (Date.now() - stat.mtimeMs > config.instrumentMasterTtlMs) return null;
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeCacheToDisk(instruments) {
  ensureCacheDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(instruments));
}

/**
 * Builds symbol -> { token, name } only for the NSE equity rows we actually
 * care about (the current Nifty 50 list), so we don't keep ~100k option/future
 * rows in memory.
 */
function indexNifty50(instruments) {
  const wanted = new Map(NIFTY50.map((s) => [`${s.symbol}-EQ`, s.symbol]));
  const map = new Map();

  for (const row of instruments) {
    if (row.exch_seg !== 'NSE') continue;
    const baseSymbol = wanted.get(row.symbol);
    if (!baseSymbol) continue;
    map.set(baseSymbol, { token: row.token, tradingSymbol: row.symbol });
  }
  return map;
}

/**
 * Returns a Map<niftySymbol, { token, tradingSymbol }>.
 * Downloads + caches the (large) scrip master at most once every
 * INSTRUMENT_MASTER_TTL_MS, both on disk and in memory.
 */
async function getNifty50TokenMap({ forceRefresh = false } = {}) {
  if (!forceRefresh && inMemoryMap && Date.now() - inMemoryLoadedAt < config.instrumentMasterTtlMs) {
    return inMemoryMap;
  }

  let instruments = forceRefresh ? null : readCacheFromDisk();
  if (!instruments) {
    instruments = await downloadScripMaster();
    writeCacheToDisk(instruments);
  }

  inMemoryMap = indexNifty50(instruments);
  inMemoryLoadedAt = Date.now();

  const missing = NIFTY50.filter((s) => !inMemoryMap.has(s.symbol)).map((s) => s.symbol);
  if (missing.length) {
    // Not fatal - just means the index list above is stale vs. the live
    // instrument master (e.g. a fresh semi-annual rebalance). Surfacing this
    // in the server logs makes it easy to spot and fix data/nifty50.js.
    console.warn('[instrumentMaster] could not resolve tokens for:', missing.join(', '));
  }

  return inMemoryMap;
}

module.exports = { getNifty50TokenMap };
