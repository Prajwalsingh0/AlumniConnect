/**
 * Event reminders.
 *
 * Reminds registered attendees shortly before an event starts. Runs inside the
 * server process on an interval, matching the existing single-process design of
 * the rate limiter; a multi-instance deployment would want this in a worker
 * with a shared lock.
 *
 * Reminders are claimed per event before any notification is written, so two
 * overlapping runs (or two instances) cannot double-send. Whether an individual
 * attendee actually receives one is decided by their notification preferences.
 */
const Event = require('../models/Event');
const { createNotification } = require('./notificationService');

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000; // remind within a day of the start
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // check every fifteen minutes

function describeWhen(startDate, isVirtual) {
  const when = startDate.toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  });
  return isVirtual ? `${when} (online)` : when;
}

/**
 * Send reminders for published events starting inside the window.
 * The clock is injectable so the behaviour can be verified without waiting.
 */
async function runEventReminders({ now = new Date(), windowMs = DEFAULT_WINDOW_MS } = {}) {
  const until = new Date(now.getTime() + windowMs);

  const candidates = await Event.find({
    status: 'published',
    startDate: { $gt: now, $lte: until },
    remindersSentAt: { $exists: false },
    'attendees.0': { $exists: true }
  }).lean();

  const results = [];

  for (const event of candidates) {
    // Claim the event first: only one run gets the updated document back
    const claimed = await Event.findOneAndUpdate(
      { _id: event._id, remindersSentAt: { $exists: false } },
      { $set: { remindersSentAt: now } },
      { new: true }
    ).lean();
    if (!claimed) continue;

    const message = `Reminder: "${event.title}" starts ${describeWhen(new Date(event.startDate), event.isVirtual)}`;
    let notified = 0;

    for (const attendee of event.attendees || []) {
      if (!attendee || !attendee.user) continue;

      const notification = await createNotification({
        recipient: attendee.user,
        actor: event.organizer,
        type: 'event_reminder',
        refType: 'Event',
        refId: event._id,
        message
      });

      if (notification) notified += 1;
    }

    results.push({
      eventId: event._id.toString(),
      title: event.title,
      attendees: (event.attendees || []).length,
      notified
    });
  }

  return results;
}

/**
 * Start the periodic check. Never throws into the caller: a failed run is
 * logged and retried on the next tick.
 */
function startEventReminderScheduler({ intervalMs = DEFAULT_INTERVAL_MS, windowMs = DEFAULT_WINDOW_MS, logger = console } = {}) {
  let running = false;

  async function tick() {
    if (running) return; // never overlap runs
    running = true;
    try {
      const results = await runEventReminders({ windowMs });
      const notified = results.reduce((total, item) => total + item.notified, 0);
      if (results.length) {
        logger.log(`Event reminders: ${results.length} event(s) due, ${notified} notification(s) sent`);
      }
    } catch (error) {
      logger.error('Event reminder run failed:', error.message);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  tick();

  return timer;
}

module.exports = {
  runEventReminders,
  startEventReminderScheduler,
  DEFAULT_WINDOW_MS,
  DEFAULT_INTERVAL_MS
};
