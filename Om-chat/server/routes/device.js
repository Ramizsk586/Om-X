const express = require('express');

const requireAuth = require('../middleware/requireAuth');
const tokenService = require('../services/tokenService');

const router = express.Router();

/**
 * Check whether a raw value matches the Om Chat device token format.
 * @param {string} value Raw device token.
 * @returns {boolean} True when the token has the expected shape.
 */
function isDeviceToken(value) {
  return /^dt_[0-9a-f]{48}$/i.test(String(value || '').trim());
}

router.get('/token', (req, res) => {
  res.json({ deviceToken: req.deviceToken || null });
});

router.post('/token', requireAuth, async (req, res, next) => {
  try {
    const requestedToken = String(req.body?.deviceToken || req.deviceToken || '').trim();
    const deviceToken = isDeviceToken(requestedToken)
      ? requestedToken
      : tokenService.createDeviceToken();

    const boundToken = await tokenService.bindDeviceToken(req.user.id, deviceToken, {
      userAgent: req.get('user-agent') || ''
    });

    res.json({ deviceToken: boundToken });
  } catch (error) {
    next(error);
  }
});

router.delete('/token', requireAuth, async (req, res, next) => {
  try {
    if (req.deviceToken) {
      await tokenService.revokeDeviceToken(req.deviceToken);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
