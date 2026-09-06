const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'mentorship_request',
  'mentorship_accepted',
  'mentorship_rejected',
  'mentorship_cancelled',
  'mentorship_completed'
];

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    required: true
  },
  refType: {
    type: String,
    enum: ['Mentorship'],
    default: 'Mentorship'
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentorship',
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 300
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date
}, {
  timestamps: true // createdAt / updatedAt
});

// Queries the notifications API actually runs
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
