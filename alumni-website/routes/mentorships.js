const express = require('express');
const mongoose = require('mongoose');
const Mentorship = require('../models/Mentorship');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const ACTIVE_OR_PENDING = ['pending', 'accepted'];
const MAX_MESSAGE_LENGTH = 1000;
const DIRECTORY_MAX_LIMIT = 48;

// Escape user input so it is treated literally inside $regex queries
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Public fields used whenever a mentorship is shown with its participants
const PARTICIPANT_PROJECTION = {
  name: 1,
  role: 1,
  'profile.title': 1,
  'profile.company': 1,
  'profile.graduationYear': 1,
  'profile.department': 1,
  'profile.profileImage': 1,
  'profile.profileImageThumbnail': 1
};

const isValidObjectId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

// Populate both participants with public information only
const populateParticipants = (query) => query
  .populate('mentor', PARTICIPANT_PROJECTION)
  .populate('mentee', PARTICIPANT_PROJECTION);

// Find a mentorship by id; non-participants get 404 so the existence of
// other people's mentorships is never revealed.
async function findForParticipant(req, res) {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid mentorship id' });
    return null;
  }

  const mentorship = await populateParticipants(
    Mentorship.findById(req.params.id)
  );

  if (!mentorship) {
    res.status(404).json({ error: 'Mentorship not found' });
    return null;
  }

  const me = req.user.userId;
  const isMentor = mentorship.mentor._id.toString() === me;
  const isMentee = mentorship.mentee._id.toString() === me;

  if (!isMentor && !isMentee) {
    res.status(404).json({ error: 'Mentorship not found' });
    return null;
  }

  return { mentorship, isMentor, isMentee };
}

// Create a mentorship request (the authenticated user becomes the mentee)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { mentorId, message } = req.body;

    if (!isValidObjectId(mentorId)) {
      return res.status(400).json({ error: 'A valid mentorId is required' });
    }
    if (mentorId === req.user.userId) {
      return res.status(400).json({ error: 'You cannot request mentorship from yourself' });
    }
    if (typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ error: 'Please include a short message (at least 10 characters)' });
    }
    if (message.trim().length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
    }

    const mentor = await User.findById(mentorId).select('_id isActive');
    if (!mentor || !mentor.isActive) {
      return res.status(404).json({ error: 'Mentor not found' });
    }

    // Duplicate protection: no pending/accepted mentorship between the same
    // two users, in either direction.
    const existing = await Mentorship.findOne({
      status: { $in: ACTIVE_OR_PENDING },
      $or: [
        { mentor: req.user.userId, mentee: mentorId },
        { mentor: mentorId, mentee: req.user.userId }
      ]
    }).select('_id status');

    if (existing) {
      const statusText = existing.status === 'pending' ? 'already pending' : 'already active';
      return res.status(409).json({
        error: `A mentorship request between you and this user is ${statusText}`
      });
    }

    const mentorship = await Mentorship.create({
      mentee: req.user.userId,
      mentor: mentorId,
      message: message.trim()
    });

    const populated = await populateParticipants(Mentorship.findById(mentorship._id));

    res.status(201).json({
      message: 'Mentorship request sent.',
      mentorship: populated
    });
  } catch (error) {
    console.error('Create mentorship error:', error);
    res.status(500).json({ error: 'Failed to send mentorship request' });
  }
});

// List mentorships of the authenticated user with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    let page = 1;
    if (req.query.page !== undefined && req.query.page !== '') {
      page = Number(req.query.page);
      if (!Number.isInteger(page) || page < 1) {
        return res.status(400).json({ error: 'page must be a positive integer' });
      }
    }

    let limit = 12;
    if (req.query.limit !== undefined && req.query.limit !== '') {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > DIRECTORY_MAX_LIMIT) {
        return res.status(400).json({ error: `limit must be an integer between 1 and ${DIRECTORY_MAX_LIMIT}` });
      }
    }

    const filter = {};
    if (req.query.role === 'mentor') {
      filter.mentor = req.user.userId;
    } else if (req.query.role === 'mentee') {
      filter.mentee = req.user.userId;
    } else {
      filter.$or = [{ mentor: req.user.userId }, { mentee: req.user.userId }];
    }

    if (req.query.status !== undefined && req.query.status !== '') {
      if (!['pending', 'accepted', 'rejected', 'cancelled', 'completed'].includes(req.query.status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      filter.status = req.query.status;
    }

    const [mentorships, total] = await Promise.all([
      populateParticipants(
        Mentorship.find(filter)
          .sort({ updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
      ),
      Mentorship.countDocuments(filter)
    ]);

    res.json({
      mentorships,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('List mentorships error:', error);
    res.status(500).json({ error: 'Failed to load mentorships' });
  }
});

// Pending requests where the authenticated user is the mentor
router.get('/requests/received', authenticateToken, async (req, res) => {
  try {
    const requests = await populateParticipants(
      Mentorship.find({ mentor: req.user.userId, status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(100)
    );
    res.json({ mentorships: requests });
  } catch (error) {
    console.error('Received mentorship requests error:', error);
    res.status(500).json({ error: 'Failed to load received requests' });
  }
});

// Pending requests created by the authenticated user
router.get('/requests/sent', authenticateToken, async (req, res) => {
  try {
    const requests = await populateParticipants(
      Mentorship.find({ mentee: req.user.userId, status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(100)
    );
    res.json({ mentorships: requests });
  } catch (error) {
    console.error('Sent mentorship requests error:', error);
    res.status(500).json({ error: 'Failed to load sent requests' });
  }
});

// Viewer-specific relationship state toward another user (used by the
// public profile page to decide which mentorship button to show)
router.get('/status/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const existing = await Mentorship.findOne({
      status: { $in: ACTIVE_OR_PENDING },
      $or: [
        { mentor: req.user.userId, mentee: userId },
        { mentor: userId, mentee: req.user.userId }
      ]
    }).select('_id status mentor mentee');

    if (!existing) {
      return res.json({ status: 'none' });
    }

    const iAmMentor = existing.mentor.toString() === req.user.userId;
    res.json({
      status: existing.status,
      direction: iAmMentor ? 'received' : 'sent',
      mentorshipId: existing._id
    });
  } catch (error) {
    console.error('Mentorship status error:', error);
    res.status(500).json({ error: 'Failed to load mentorship status' });
  }
});

// Get one mentorship (participants only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const found = await findForParticipant(req, res);
    if (!found) return;
    res.json({ mentorship: found.mentorship });
  } catch (error) {
    console.error('Get mentorship error:', error);
    res.status(500).json({ error: 'Failed to load mentorship' });
  }
});

// Accept: mentor only, pending only
router.patch('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const found = await findForParticipant(req, res);
    if (!found) return;
    const { mentorship, isMentor } = found;

    if (!isMentor) {
      return res.status(403).json({ error: 'Only the mentor can accept this request' });
    }
    if (mentorship.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending requests can be accepted' });
    }

    mentorship.status = 'accepted';
    mentorship.respondedAt = new Date();
    await mentorship.save();

    res.json({ message: 'Mentorship accepted.', mentorship });
  } catch (error) {
    console.error('Accept mentorship error:', error);
    res.status(500).json({ error: 'Failed to accept mentorship' });
  }
});

// Reject: mentor only, pending only
router.patch('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const found = await findForParticipant(req, res);
    if (!found) return;
    const { mentorship, isMentor } = found;

    if (!isMentor) {
      return res.status(403).json({ error: 'Only the mentor can reject this request' });
    }
    if (mentorship.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending requests can be rejected' });
    }

    mentorship.status = 'rejected';
    mentorship.respondedAt = new Date();
    await mentorship.save();

    res.json({ message: 'Mentorship request rejected.', mentorship });
  } catch (error) {
    console.error('Reject mentorship error:', error);
    res.status(500).json({ error: 'Failed to reject mentorship' });
  }
});

// Cancel: mentee only, pending only
router.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const found = await findForParticipant(req, res);
    if (!found) return;
    const { mentorship, isMentee } = found;

    if (!isMentee) {
      return res.status(403).json({ error: 'Only the mentee can cancel this request' });
    }
    if (mentorship.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending requests can be cancelled' });
    }

    mentorship.status = 'cancelled';
    mentorship.respondedAt = new Date();
    await mentorship.save();

    res.json({ message: 'Mentorship request cancelled.', mentorship });
  } catch (error) {
    console.error('Cancel mentorship error:', error);
    res.status(500).json({ error: 'Failed to cancel mentorship' });
  }
});

// Complete: either participant, accepted only
router.patch('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const found = await findForParticipant(req, res);
    if (!found) return;
    const { mentorship } = found;

    if (mentorship.status !== 'accepted') {
      return res.status(409).json({ error: 'Only active mentorships can be completed' });
    }

    mentorship.status = 'completed';
    mentorship.completedAt = new Date();
    await mentorship.save();

    res.json({ message: 'Mentorship completed. Thank you both!', mentorship });
  } catch (error) {
    console.error('Complete mentorship error:', error);
    res.status(500).json({ error: 'Failed to complete mentorship' });
  }
});

module.exports = router;
