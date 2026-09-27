const Notification = require('../models/Notification');
const User = require('../models/User');

// Notification types grouped by the preference that controls them
const TYPE_PREFERENCE = {
  message: 'messages',
  review: 'reviews',
  event_reminder: 'reminders'
};

function preferenceKeyFor(type) {
  if (TYPE_PREFERENCE[type]) return TYPE_PREFERENCE[type];
  if (typeof type === 'string' && type.startsWith('mentorship')) return 'mentorship';
  return null; // unknown types are never suppressed
}

/**
 * Only an explicit opt-out suppresses a notification, and a lookup failure
 * lets it through: a missed notification is worse than an unwanted one.
 */
async function isNotificationAllowed(recipient, type) {
  const key = preferenceKeyFor(type);
  if (!key) return true;

  try {
    const user = await User.findById(recipient).select('notificationPreferences').lean();
    const preferences = user && user.notificationPreferences;
    if (!preferences) return true;
    return preferences[key] !== false;
  } catch (error) {
    console.error('Notification preference lookup failed:', error.message);
    return true;
  }
}

let ioInstance = null;

/**
 * Called once from server.js after the Socket.IO server is created so the
 * service can push real-time notifications to per-user rooms.
 */
function setIo(io) {
  ioInstance = io;
}

/**
 * Create a notification and push it live to the recipient's room.
 * Never throws: notification creation must not break the triggering action.
 */
async function createNotification({ recipient, actor, type, refType = 'Mentorship', refId, message }) {
  try {
    // The triggering action has already happened; this only decides whether the
    // recipient is told about it.
    if (!(await isNotificationAllowed(recipient, type))) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      actor,
      type,
      refType,
      refId,
      message: String(message).slice(0, 300)
    });

    if (ioInstance) {
      ioInstance.to(recipient.toString()).emit('notification', {
        id: notification._id,
        type: notification.type,
        refType: notification.refType,
        refId: notification.refId,
        actor: notification.actor,
        message: notification.message,
        createdAt: notification.createdAt,
        read: false
      });
    }

    return notification;
  } catch (error) {
    console.error('Notification creation failed:', error.message);
    return null;
  }
}

module.exports = { createNotification, setIo };
