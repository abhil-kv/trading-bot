const express = require('express');
const config = require('../config');
const { loginWithCredentials, logout } = require('../services/angelAuth.service');

const router = express.Router();

router.get('/defaults', (req, res) => {
  res.json({
    success: true,
    defaults: config.defaultLogin,
  });
});

router.post('/login', async (req, res) => {
  const { clientId, pin, totpSecret, apiKey, apiSecret } = req.body || {};

  const missing = ['clientId', 'pin', 'totpSecret', 'apiKey'].filter((f) => !req.body || !req.body[f]);
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
  }

  try {
    const tokens = await loginWithCredentials({ clientId, pin, totpSecret, apiKey });

    // Kept server-side only, in memory, for this session - never sent back
    // to the browser. pin/totpSecret are retained so we can transparently
    // re-login if the refresh token also expires (Angel One sessions die at
    // midnight regardless of activity).
    req.session.angel = {
      clientId,
      pin,
      totpSecret,
      apiKey,
      apiSecret: apiSecret || null,
      ...tokens,
      loggedInAt: new Date().toISOString(),
    };

    req.session.save(() => {
      res.json({ success: true, clientId });
    });
  } catch (err) {
    const message = err.response?.data?.message || err.message || 'Login failed';
    res.status(401).json({ success: false, message });
  }
});

router.post('/logout', async (req, res) => {
  const angel = req.session && req.session.angel;
  try {
    if (angel) {
      await logout(angel).catch(() => {}); // best-effort; clear local session regardless
    }
  } finally {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  }
});

router.get('/session', (req, res) => {
  const angel = req.session && req.session.angel;
  res.json({
    authenticated: !!(angel && angel.jwtToken),
    clientId: angel ? angel.clientId : null,
  });
});

module.exports = router;
