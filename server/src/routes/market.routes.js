const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { getNifty50Quotes } = require('../services/marketData.service');

const router = express.Router();

router.get('/nifty50', requireAuth, async (req, res) => {
  try {
    const data = await getNifty50Quotes(req.session.angel);
    req.session.save(() => {}); // persist any token refresh that happened mid-call
    res.json({ success: true, ...data });
  } catch (err) {
    const message = err.response?.data?.message || err.message || 'Failed to fetch market data';
    res.status(502).json({ success: false, message });
  }
});

module.exports = router;
