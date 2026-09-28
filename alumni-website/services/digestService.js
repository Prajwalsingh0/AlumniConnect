/**
 * Weekly email digests.
 *
 * Builds a short summary of what a member missed and mails it. Two rules matter:
 *
 *  - Nothing is sent without content. A member with no activity is skipped, so
 *    the digest never becomes noise.
 *  - Sending is best effort. When SMTP is not configured the run reports what it
 *    would have sent and stops, and the member's timestamp is left alone so the
 *    next run retries instead of silently skipping them forever.
 *
 * The clock and window are injectable, which is how this is verified without
 * waiting a week or having a mail server.
 */
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const Event = require('../models/Event');
const Mentorship = require('../models/Mentorship');
const Review = require('../models/Review');
const Job = require('../models/Job');
const Group = require('../models/Group');
const ForumPost = require('../models/ForumPost');
const { sendDigestEmail, isEmailConfigured } = require('./emailService');

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // check daily
const BATCH_LIMIT = 500;

async function buildDigest(userId, { now = new Date(), since } = {}) {
  const windowStart = since || new Date(now.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const groups = await Group.find({ 'members.user': userId }).select('_id').lean();
  const groupIds = groups.map((g) => g._id);

  const [
    conversations,
    unreadNotifications,
    upcomingEvents,
    openRequests,
    newReviews,
    newJobs,
    groupPosts
  ] = await Promise.all([
    Conversation.find({ participants: userId }).select('unreadCount').lean(),
    Notification.countDocuments({ recipient: userId, read: false, createdAt: { $gte: windowStart } }),
    Event.find({ 'attendees.user': userId, startDate: { $gte: now, $lte: soon } })
      .select('title startDate isVirtual')
      .sort({ startDate: 1 })
      .limit(5)
      .lean(),
    Mentorship.countDocuments({ mentor: userId, status: 'pending' }),
    Review.countDocuments({ reviewee: userId, createdAt: { $gte: windowStart } }),
    Job.countDocuments({ status: 'published', createdAt: { $gte: windowStart } }),
    groupIds.length
      ? ForumPost.countDocuments({ group: { $in: groupIds }, createdAt: { $gte: windowStart } })
      : 0
  ]);

  // unreadCount is a Map in the schema, but lean() hands back a plain object
  // keyed by the participant id, so both shapes have to be handled.
  const unreadMessages = conversations.reduce((total, conversation) => {
    if (!conversation.unreadCount) return total;
    const key = String(userId);
    const value = conversation.unreadCount.get
      ? conversation.unreadCount.get(key)
      : conversation.unreadCount[key];
    return total + (Number(value) || 0);
  }, 0);

  const digest = {
    since: windowStart,
    unreadMessages,
    unreadNotifications,
    pendingMentorshipRequests: openRequests,
    newReviews,
    newJobs,
    groupPosts,
    upcomingEvents: upcomingEvents.map((event) => ({
      title: event.title,
      date: event.startDate,
      isVirtual: !!event.isVirtual
    }))
  };

  // Only activity that concerns this member triggers a message. Network-wide
  // extras such as new job postings ride along when there is something personal
  // to report, but they never cause an email on their own - otherwise everyone
  // would be mailed every week simply because the job board moved.
  const hasContent = unreadMessages > 0 || unreadNotifications > 0 || openRequests > 0 ||
    newReviews > 0 || groupPosts > 0 || digest.upcomingEvents.length > 0;

  return { hasContent, ...digest };
}

/**
 * Run the digest for everyone due for one. Returns a per-recipient summary so a
 * caller (or a test) can see exactly what happened without reading logs.
 */
async function runDigests({ now = new Date(), windowDays = DEFAULT_WINDOW_DAYS, dryRun = false, limit = BATCH_LIMIT } = {}) {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const dueBefore = new Date(now.getTime() - windowMs);
  const since = new Date(now.getTime() - windowMs);

  // 'digests' is only false when someone switched it off
  const users = await User.find({
    isActive: { $ne: false },
    'notificationPreferences.digests': { $ne: false },
    $or: [{ lastDigestAt: { $exists: false } }, { lastDigestAt: { $lte: dueBefore } }]
  }).select('name email lastDigestAt').limit(limit).lean();

  const results = [];
  const emailReady = isEmailConfigured();

  for (const user of users) {
    const digest = await buildDigest(user._id, { now, since });

    if (!digest.hasContent) {
      results.push({ user: user._id.toString(), email: user.email, outcome: 'skipped-empty' });
      continue;
    }

    if (dryRun) {
      results.push({ user: user._id.toString(), email: user.email, outcome: 'would-send', digest });
      continue;
    }

    if (!emailReady) {
      results.push({ user: user._id.toString(), email: user.email, outcome: 'skipped-no-mail-config', digest });
      continue;
    }

    try {
      await sendDigestEmail(user.email, user.name, digest, { now });
      await User.updateOne({ _id: user._id }, { $set: { lastDigestAt: now } });
      results.push({ user: user._id.toString(), email: user.email, outcome: 'sent' });
    } catch (error) {
      // Leave lastDigestAt alone so the next run tries again
      console.error(`Digest for ${user.email} failed:`, error.message);
      results.push({ user: user._id.toString(), email: user.email, outcome: 'failed', error: error.message });
    }
  }

  return {
    checked: users.length,
    emailConfigured: emailReady,
    results
  };
}

/**
 * Daily check. Never throws into the caller: a failed run is logged and retried
 * on the next tick.
 */
function startDigestScheduler({ intervalMs = DEFAULT_INTERVAL_MS, windowDays = DEFAULT_WINDOW_DAYS, logger = console } = {}) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const summary = await runDigests({ windowDays });
      const sent = summary.results.filter((r) => r.outcome === 'sent').length;
      if (sent > 0 || summary.results.length > 0) {
        logger.log(`Email digests: checked ${summary.checked}, sent ${sent}${summary.emailConfigured ? '' : ' (mail not configured)'}`);
      }
    } catch (error) {
      logger.error('Email digest run failed:', error.message);
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
  buildDigest,
  runDigests,
  startDigestScheduler,
  DEFAULT_WINDOW_DAYS,
  DEFAULT_INTERVAL_MS
};
