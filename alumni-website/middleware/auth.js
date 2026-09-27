const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (!user || !user.userId || !mongoose.Types.ObjectId.isValid(user.userId)) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    // Tokens are stateless, so without this lookup a deleted account could keep
    // using an unexpired token. Single indexed read by _id.
    try {
      const account = await User.findById(user.userId).select('isActive').lean();
      if (!account || account.isActive === false) {
        return res.status(401).json({ error: 'This account is no longer active', code: 'ACCOUNT_INACTIVE' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth account lookup error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });
}

/**
 * Populate req.user when a valid token is present, but never reject the request.
 * Used where the response depends on membership - a group listing, for example,
 * shows private groups only to their members while still serving visitors.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err || !user || !user.userId || !mongoose.Types.ObjectId.isValid(user.userId)) {
      return next();
    }

    try {
      const account = await User.findById(user.userId).select('isActive').lean();
      if (account && account.isActive !== false) {
        req.user = user;
      }
    } catch (error) {
      // Treat an unreadable account as anonymous
      console.error('Optional auth lookup error:', error.message);
    }

    next();
  });
}

module.exports = { authenticateToken, optionalAuth };