const Notification = require('../models/Notification');

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
async function createNotification({ recipient, actor, type, refId, message }) {
  try {
    const notification = await Notification.create({
      recipient,
      actor,
      type,
      refType: 'Mentorship',
      refId,
      message: String(message).slice(0, 300)
    });

    if (ioInstance) {
      ioInstance.to(recipient.toString()).emit('notification', {
        id: notification._id,
        type: notification.type,
        refId: notification.refId,
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
