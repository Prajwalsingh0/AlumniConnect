/**
 * Mentorship sessions.
 *
 * A session is a scheduled meeting inside an accepted mentorship: one
 * participant proposes a time, the other confirms or declines, and either can
 * cancel while it is still ahead. Non-participants get 404 everywhere so the
 * existence of other people's sessions is never revealed.
 */
const express = require('express');
const mongoose = require('mongoose');
const Mentorship = require('../models/Mentorship');
const { MentorshipSession } = require('../models/MentorshipSession');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const router = express.Router();

const MAX_AGENDA_LENGTH = 300;
const MAX_LINK_LENGTH = 300;
const MIN_DURATION = 15;
const MAX_DURATION = 480;
const MAX_UPCOMING_PER_MENTORSHIP = 10;
const UPCOMING_STATUSES = ['proposed', 'confirmed'];

const PARTICIPANT_FIELDS = {
  name: 1,
  'profile.title': 1,
  'profile.company': 1,
  'profile.profileImage': 1
};

const isValidObjectId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

const participantIds = (mentorship) => [
  mentorship.mentor.toString(),
  mentorship.mentee.toString()
];

const otherParty = (mentorship, me) =>
  mentorship.mentor.toString() === me ? mentorship.mentee : mentorship.mentor;

function describeWhen(date) {
  return new Date(date).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
  });
}

function serialize(session) {
  return {
    _id: session._id,
    mentorship: session.mentorship,
    proposedBy: session.proposedBy,
    scheduledFor: session.scheduledFor,
    durationMinutes: session.durationMinutes,
    agenda: session.agenda || '',
    meetingLink: session.meetingLink || '',
    status: session.status,
    respondedAt: session.respondedAt,
    createdAt: session.createdAt
  };
}

// Load a session together with its mentorship, for participants only
async function loadForParticipant(req, res) {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid session id' });
    return null;
  }

  const session = await MentorshipSession.findById(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }

  const mentorship = await Mentorship.findById(session.mentorship);
  if (!mentorship || !participantIds(mentorship).includes(req.user.userId)) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }

  return { session, mentorship };
}

// Notifications are best effort: a session must never fail because of one
async function notify(mentorship, recipient, actorId, type, message) {
  try {
    await createNotification({
      recipient,
      actor: actorId,
      type,
      refType: 'Mentorship',
      refId: mentorship._id,
      message
    });
  } catch (error) {
    console.error('Session notification failed:', error.message);
  }
}

async function actorName(userId) {
  const user = await User.findById(userId).select('name').lean();
  return (user && user.name) || 'Your mentorship partner';
}

// Propose a session
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { mentorshipId, scheduledFor, durationMinutes, agenda, meetingLink } = req.body || {};

    if (!isValidObjectId(mentorshipId)) {
      return res.status(400).json({ error: 'A valid mentorshipId is required' });
    }

    const when = new Date(scheduledFor);
    if (scheduledFor === undefined || scheduledFor === null || isNaN(when.getTime())) {
      return res.status(400).json({ error: 'A valid date and time is required' });
    }
    if (when.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Pick a time in the future' });
    }

    let duration = 60;
    if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes !== '') {
      duration = Number(durationMinutes);
      if (!Number.isInteger(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
        return res.status(400).json({ error: `Duration must be between ${MIN_DURATION} and ${MAX_DURATION} minutes` });
      }
    }

    let note = '';
    if (agenda !== undefined && agenda !== null) {
      if (typeof agenda !== 'string') {
        return res.status(400).json({ error: 'Agenda must be text' });
      }
      note = agenda.trim();
      if (note.length > MAX_AGENDA_LENGTH) {
        return res.status(400).json({ error: `Agenda cannot exceed ${MAX_AGENDA_LENGTH} characters` });
      }
    }

    let link = '';
    if (meetingLink !== undefined && meetingLink !== null && meetingLink !== '') {
      if (typeof meetingLink !== 'string') {
        return res.status(400).json({ error: 'Meeting link must be text' });
      }
      link = meetingLink.trim();
      if (link.length > MAX_LINK_LENGTH) {
        return res.status(400).json({ error: `Meeting link cannot exceed ${MAX_LINK_LENGTH} characters` });
      }
      if (!/^https?:\/\//i.test(link)) {
        return res.status(400).json({ error: 'Meeting link must start with http:// or https://' });
      }
    }

    const mentorship = await Mentorship.findById(mentorshipId);
    if (!mentorship || !participantIds(mentorship).includes(req.user.userId)) {
      return res.status(404).json({ error: 'Mentorship not found' });
    }
    if (mentorship.status !== 'accepted') {
      return res.status(409).json({ error: 'Sessions can only be scheduled for an active mentorship' });
    }

    const upcoming = await MentorshipSession.countDocuments({
      mentorship: mentorship._id,
      status: { $in: UPCOMING_STATUSES },
      scheduledFor: { $gt: new Date() }
    });
    if (upcoming >= MAX_UPCOMING_PER_MENTORSHIP) {
      return res.status(400).json({ error: `This mentorship already has ${MAX_UPCOMING_PER_MENTORSHIP} sessions scheduled` });
    }

    const session = await MentorshipSession.create({
      mentorship: mentorship._id,
      proposedBy: req.user.userId,
      scheduledFor: when,
      durationMinutes: duration,
      agenda: note || undefined,
      meetingLink: link || undefined,
      status: 'proposed'
    });

    const name = await actorName(req.user.userId);
    await notify(
      mentorship,
      otherParty(mentorship, req.user.userId),
      req.user.userId,
      'mentorship_session_proposed',
      `${name} proposed a mentorship session on ${describeWhen(when)}`
    );

    res.status(201).json({ session: serialize(session) });
  } catch (error) {
    console.error('Propose session error:', error);
    res.status(500).json({ error: 'Failed to propose the session' });
  }
});

// My sessions, soonest first
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const me = req.user.userId;

    const mentorships = await Mentorship.find({ $or: [{ mentor: me }, { mentee: me }] })
      .select('_id mentor mentee status')
      .lean();
    if (!mentorships.length) {
      return res.json({ sessions: [] });
    }

    const scope = req.query.scope;
    const filter = { mentorship: { $in: mentorships.map((m) => m._id) } };
    if (scope === 'upcoming') {
      filter.status = { $in: UPCOMING_STATUSES };
      filter.scheduledFor = { $gt: new Date() };
    } else if (scope === 'past') {
      filter.$or = [{ status: { $in: ['declined', 'cancelled'] } }, { scheduledFor: { $lte: new Date() } }];
    } else if (scope !== undefined && scope !== '') {
      return res.status(400).json({ error: 'scope must be upcoming or past' });
    }

    const sessions = await MentorshipSession.find(filter).sort({ scheduledFor: 1 }).lean();

    // Attach the mentorship and the other participant in one extra query
    const mentorshipById = new Map(mentorships.map((m) => [m._id.toString(), m]));
    const partnerIds = new Set();
    const enriched = sessions.map((session) => {
      const mentorship = mentorshipById.get(session.mentorship.toString()) || {};
      const partnerId = otherParty(
        { mentor: mentorship.mentor || me, mentee: mentorship.mentee || me },
        me
      ).toString();
      partnerIds.add(partnerId);
      return { session, partnerId, mentorshipStatus: mentorship.status };
    });

    const partners = await User.find({ _id: { $in: [...partnerIds] } }).select(PARTICIPANT_FIELDS).lean();
    const partnerById = new Map(partners.map((p) => [p._id.toString(), p]));

    res.json({
      sessions: enriched.map((item) => ({
        ...serialize(item.session),
        mentorshipStatus: item.mentorshipStatus,
        partner: partnerById.get(item.partnerId) || null
      }))
    });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Failed to load your sessions' });
  }
});

// Sessions of one mentorship
router.get('/mentorship/:mentorshipId', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.mentorshipId)) {
      return res.status(400).json({ error: 'Invalid mentorship id' });
    }

    const mentorship = await Mentorship.findById(req.params.mentorshipId);
    if (!mentorship || !participantIds(mentorship).includes(req.user.userId)) {
      return res.status(404).json({ error: 'Mentorship not found' });
    }

    const sessions = await MentorshipSession.find({ mentorship: mentorship._id })
      .sort({ scheduledFor: 1 })
      .lean();

    res.json({ sessions: sessions.map(serialize) });
  } catch (error) {
    console.error('List mentorship sessions error:', error);
    res.status(500).json({ error: 'Failed to load the sessions' });
  }
});

// Confirm a proposed session (the other participant, never the proposer)
router.patch('/:id/confirm', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadForParticipant(req, res);
    if (!loaded) return;
    const { session, mentorship } = loaded;

    if (session.proposedBy.toString() === req.user.userId) {
      return res.status(403).json({ error: 'Wait for the other participant to respond to your proposal' });
    }
    if (session.status !== 'proposed') {
      return res.status(409).json({ error: `This session is already ${session.status}` });
    }

    session.status = 'confirmed';
    session.respondedAt = new Date();
    await session.save();

    const name = await actorName(req.user.userId);
    await notify(
      mentorship,
      session.proposedBy,
      req.user.userId,
      'mentorship_session_confirmed',
      `${name} confirmed your mentorship session on ${describeWhen(session.scheduledFor)}`
    );

    res.json({ session: serialize(session) });
  } catch (error) {
    console.error('Confirm session error:', error);
    res.status(500).json({ error: 'Failed to confirm the session' });
  }
});

// Decline a proposed session (the other participant only)
router.patch('/:id/decline', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadForParticipant(req, res);
    if (!loaded) return;
    const { session, mentorship } = loaded;

    if (session.proposedBy.toString() === req.user.userId) {
      return res.status(403).json({ error: 'Cancel your own proposal instead of declining it' });
    }
    if (session.status !== 'proposed') {
      return res.status(409).json({ error: `This session is already ${session.status}` });
    }

    session.status = 'declined';
    session.respondedAt = new Date();
    await session.save();

    const name = await actorName(req.user.userId);
    await notify(
      mentorship,
      session.proposedBy,
      req.user.userId,
      'mentorship_session_declined',
      `${name} declined the mentorship session on ${describeWhen(session.scheduledFor)}`
    );

    res.json({ session: serialize(session) });
  } catch (error) {
    console.error('Decline session error:', error);
    res.status(500).json({ error: 'Failed to decline the session' });
  }
});

// Cancel a session (either participant, while it is still ahead)
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadForParticipant(req, res);
    if (!loaded) return;
    const { session, mentorship } = loaded;

    if (!UPCOMING_STATUSES.includes(session.status)) {
      return res.status(409).json({ error: `This session is already ${session.status}` });
    }

    session.status = 'cancelled';
    session.respondedAt = new Date();
    await session.save();

    const name = await actorName(req.user.userId);
    await notify(
      mentorship,
      otherParty(mentorship, req.user.userId),
      req.user.userId,
      'mentorship_session_cancelled',
      `${name} cancelled the mentorship session on ${describeWhen(session.scheduledFor)}`
    );

    res.json({ session: serialize(session) });
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({ error: 'Failed to cancel the session' });
  }
});

module.exports = router;
