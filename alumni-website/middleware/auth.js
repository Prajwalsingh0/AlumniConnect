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

module.exports = { authenticateToken };