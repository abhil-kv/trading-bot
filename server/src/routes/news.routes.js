const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/requireAuth');
const config = require('../config');

const router = express.Router();

// Cache for news data with query params as key
const newsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get('/', requireAuth, async (req, res) => {
  try {
    if (!config.marketaux.apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Marketaux API key not configured. Please add MARKETAUX_API_KEY to your .env file.'
      });
    }

    // Get query parameters from request
    const {
      countries = 'in',
      filter_entities = 'true',
      limit = '10',
      published_after,
      language = 'en',
    } = req.query;

    // Create cache key from params
    const cacheKey = JSON.stringify({ countries, filter_entities, limit, published_after, language });
    const cached = newsCache.get(cacheKey);

    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({ success: true, ...cached.data, cached: true });
    }

    // Build params object
    const params = {
      api_token: config.marketaux.apiKey,
      countries,
      filter_entities: filter_entities === 'true',
      limit: parseInt(limit, 10),
      language,
    };

    // Add published_after if provided
    if (published_after) {
      params.published_after = published_after;
    }

    // Fetch news from Marketaux API
    const { data } = await axios.get(`${config.marketaux.baseUrl}/news/all`, {
      params,
      timeout: 10000,
    });

    if (!data || !data.data) {
      return res.status(502).json({
        success: false,
        message: 'Invalid response from Marketaux API'
      });
    }

    const responseData = {
      news: data.data,
      meta: data.meta || {},
    };

    // Update cache
    newsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now(),
    });

    res.json({ success: true, ...responseData, cached: false });
  } catch (err) {
    console.error('Error fetching news:', err.message);
    const message = err.response?.data?.message || err.message || 'Failed to fetch news';
    res.status(502).json({ success: false, message });
  }
});

module.exports = router;

// Made with Bob
