const mongoose = require('mongoose');

/**
 * Every time an admin reads private material (a conversation, a mentorship),
 * an entry is written here. Moderation access should be accountable.
 */
const adminAuditLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    maxlength: 60
  },
  targetType: {
    type: String,
    required: true,
    maxlength: 40
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  detail: {
    type: String,
    maxlength: 300
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
