const axios = require('axios');
const config = require('../config');
const { buildAngelHeaders } = require('../utils/angelHeaders');
const { refreshOrRelogin } = require('./angelAuth.service');
const { getNifty50TokenMap } = require('./instrumentMaster.service');
const NIFTY50 = require('../data/nifty50');

const MAX_TOKENS_PER_REQUEST = 50; // documented cap for the FULL/OHLC/LTP quote modes

// Index symbols to fetch (these are the trading symbols on NSE)
const INDICES = [
  { symbol: 'NIFTY', name: 'NIFTY 50', tradingSymbol: 'Nifty 50' },
  { symbol: 'BANKNIFTY', name: 'BANK NIFTY', tradingSymbol: 'Nifty Bank' },
  { symbol: 'FINNIFTY', name: 'FIN NIFTY', tradingSymbol: 'Nifty Fin Service' },
  { symbol: 'SENSEX', name: 'SENSEX', tradingSymbol: 'BSE Sensex' },
];

let cache = { at: 0, payload: null };

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function callQuote({ apiKey, jwtToken }, tokens) {
  const headers = await buildAngelHeaders({ apiKey, jwtToken });
  const url = `${config.angel.baseUrl}${config.angel.quotePath}`;
  const { data } = await axios.post(
    url,
    { mode: 'FULL', exchangeTokens: { NSE: tokens } },
    { headers, timeout: 10000 }
  );
  if (!data || data.status !== true) {
    const err = new Error((data && data.message) || 'Quote request failed');
    err.angelErrorCode = data && data.errorcode;
    throw err;
  }
  return data.data; // { fetched: [...], unfetched: [...] }
}

/** Runs `fn`, and if Angel One says the session/token is invalid, refreshes
 * the session once (mutating sessionAngel in place) and retries exactly once. */
async function withAuthRetry(sessionAngel, fn) {
  try {
    return await fn(sessionAngel);
  } catch (err) {
    const status = err.response && err.response.status;
    const code = err.angelErrorCode || (err.response && err.response.data && err.response.data.errorcode);
    const looksLikeAuthError = status === 401 || status === 403 || ['AB1010', 'AB1018', 'AB8050', 'AB1020'].includes(code);
    if (!looksLikeAuthError) throw err;

    await refreshOrRelogin(sessionAngel);
    return fn(sessionAngel);
  }
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function shapeRow(meta, raw) {
  const ltp = toNumber(raw.ltp);
  const close = toNumber(raw.close); // previous day's close
  const netChange = raw.netChange !== undefined ? toNumber(raw.netChange) : ltp !== null && close !== null ? ltp - close : null;
  const percentChange = raw.percentChange !== undefined
    ? toNumber(raw.percentChange)
    : netChange !== null && close ? (netChange / close) * 100 : null;

  return {
    symbol: meta.symbol,
    name: meta.name,
    tradingSymbol: raw.tradingSymbol || `${meta.symbol}-EQ`,
    ltp,
    open: toNumber(raw.open),
    dayHigh: toNumber(raw.high),
    dayLow: toNumber(raw.low),
    prevClose: close,
    change: netChange,
    changePercent: percentChange,
    high52: toNumber(raw['52WeekHigh']),
    low52: toNumber(raw['52WeekLow']),
    volume: toNumber(raw.tradeVolume),
    exchFeedTime: raw.exchFeedTime || null,
  };
}

/**
 * Returns Nifty 50 quotes shaped for the Home grid, in the same order as
 * data/nifty50.js. Results are cached briefly so that several browser tabs
 * polling at once don't multiply calls to Angel One.
 */
async function getNifty50Quotes(sessionAngel) {
  if (cache.payload && Date.now() - cache.at < config.quoteCacheTtlMs) {
    return cache.payload;
  }

  const tokenMap = await getNifty50TokenMap();

  const resolvable = NIFTY50.filter((s) => tokenMap.has(s.symbol));
  const tokenToMeta = new Map(resolvable.map((s) => [tokenMap.get(s.symbol).token, s]));
  const tokens = resolvable.map((s) => tokenMap.get(s.symbol).token);

  const batches = chunk(tokens, MAX_TOKENS_PER_REQUEST);
  const fetchedRows = [];
  const unfetched = [];

  for (const batch of batches) {
    const result = await withAuthRetry(sessionAngel, (s) => callQuote(s, batch));
    (result.fetched || []).forEach((raw) => {
      const meta = tokenToMeta.get(raw.symbolToken);
      if (meta) fetchedRows.push(shapeRow(meta, raw));
    });
    (result.unfetched || []).forEach((u) => unfetched.push(u));
  }

  const bySymbol = new Map(fetchedRows.map((r) => [r.symbol, r]));
  const stocks = NIFTY50.map((s) => bySymbol.get(s.symbol)).filter(Boolean);

  const payload = {
    asOf: new Date().toISOString(),
    stocks,
    unresolvedSymbols: NIFTY50.filter((s) => !tokenMap.has(s.symbol)).map((s) => s.symbol),
    unfetched,
  };

  cache = { at: Date.now(), payload };
  return payload;
}

module.exports = { getNifty50Quotes };
