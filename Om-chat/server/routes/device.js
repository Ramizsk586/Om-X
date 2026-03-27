const express = require('express');

const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/token', (req, res) => {
  res.json({ deviceToken: null, deprecated: true });
});

router.post('/token', requireAuth, async (req, res, next) => {
  try {
    res.status(410).json({
      error: 'device_token_disabled',
      message: 'Device tokens are disabled. Om Chat now restores sessions from secure cookies.'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/token', requireAuth, async (req, res, next) => {
  try {
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
