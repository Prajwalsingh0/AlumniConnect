const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Mentorship = require('../models/Mentorship');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const router = express.Router();

const MAX_COMMENT_LENGTH = 500;
const LATEST_REVIEWS_LIMIT = 5;

const isValidObjectId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

// Round to one decimal for display-friendly averages
const roundAverage = (value) => Math.round(value * 10) / 10;

// Leave a review for the other participant of a completed mentorship
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { mentorshipId, rating, comment } = req.body;

    if (!isValidObjectId(mentorshipId)) {
      return res.status(400).json({ error: 'A valid mentorshipId is required' });
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5' });
    }

    if (comment !== undefined && comment !== null && typeof comment !== 'string') {
      return res.status(400).json({ error: 'Comment must be text' });
    }
    const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
    if (trimmedComment.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters` });
    }

    const mentorship = await Mentorship.findById(mentorshipId);
    if (!mentorship) {
      return res.status(404).json({ error: 'Mentorship not found' });
    }

    const me = req.user.userId;
    const participantIds = [mentorship.mentor.toString(), mentorship.mentee.toString()];
    if (!participantIds.includes(me)) {
      // Non-participants must not learn that the mentorship exists
      return res.status(404).json({ error: 'Mentorship not found' });
    }

    if (mentorship.status !== 'completed') {
      return res.status(409).json({ error: 'Reviews can only be left after the mentorship is completed' });
    }

    const reviewee = mentorship.mentor.toString() === me ? mentorship.mentee : mentorship.mentor;

    let review;
    try {
      review = await Review.create({
        mentorship: mentorship._id,
        reviewer: me,
        reviewee,
        rating: numericRating,
        comment: trimmedComment || undefined
      });
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({ error: 'You have already reviewed this mentorship' });
      }
      throw error;
    }

    // Notify the reviewee (best effort)
    try {
      const reviewer = await User.findById(me).select('name');
      await createNotification({
        recipient: reviewee,
        actor: me,
        type: 'review',
        refType: 'Mentorship',
        refId: mentorship._id,
        message: `${reviewer && reviewer.name ? reviewer.name : 'An alumni'} left you a ${numericRating}-star mentorship review`
      });
    } catch (notifyError) {
      console.error('Review notification failed:', notifyError.message);
    }

    res.status(201).json({ message: 'Review submitted. Thank you!', review });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to submit the review' });
  }
});

// Reviews written by the authenticated user (used to hide the review action)
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const reviews = await Review.find({ reviewer: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('mentorship reviewee rating comment createdAt')
      .lean();

    res.json({ reviews });
  } catch (error) {
    console.error('List my reviews error:', error);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

// Public: rating summary and latest reviews received by a member
router.get('/user/:userId', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const reviewee = new mongoose.Types.ObjectId(req.params.userId);

    const [aggregate, reviews] = await Promise.all([
      Review.aggregate([
        { $match: { reviewee } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]),
      Review.find({ reviewee })
        .sort({ createdAt: -1 })
        .limit(LATEST_REVIEWS_LIMIT)
        .populate('reviewer', 'name profile.profileImage profile.profileImageThumbnail profile.title')
        .lean()
    ]);

    const stats = aggregate[0] || { average: 0, count: 0 };

    res.json({
      average: stats.count ? roundAverage(stats.average) : null,
      count: stats.count,
      reviews: reviews.map(function (review) {
        return {
          id: review._id,
          rating: review.rating,
          comment: review.comment || '',
          createdAt: review.createdAt,
          reviewer: review.reviewer ? {
            id: review.reviewer._id,
            name: review.reviewer.name,
            title: (review.reviewer.profile && review.reviewer.profile.title) || '',
            image: (review.reviewer.profile && (review.reviewer.profile.profileImageThumbnail || review.reviewer.profile.profileImage)) || null
          } : null
        };
      })
    });
  } catch (error) {
    console.error('Public reviews error:', error);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

module.exports = router;
