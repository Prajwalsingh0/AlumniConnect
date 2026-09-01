const express = require('express');
const Event = require('../models/Event');
const Job = require('../models/Job');
const Story = require('../models/Story');
const User = require('../models/User');
const router = express.Router();

const STORY_PROJECTION = {
  title: 1,
  excerpt: 1,
  category: 1,
  image: 1,
  createdAt: 1
};

const EVENT_PROJECTION = {
  title: 1,
  type: 1,
  startDate: 1,
  'location.venue': 1,
  'location.city': 1,
  images: 1
};

const ALUMNI_PROJECTION = {
  name: 1,
  'profile.title': 1,
  'profile.company': 1,
  'profile.graduationYear': 1,
  'profile.profileImage': 1,
  'profile.profileImageThumbnail': 1,
  'profile.openToMentorship': 1
};

// Public homepage data: live counts plus the latest stories, upcoming events
// and recently joined alumni with profiles. No authentication required.
router.get('/', async (req, res) => {
  try {
    const now = new Date();

    const [memberCount, jobCount, storyCount, upcomingEvents, latestStories, featuredAlumni] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Job.countDocuments({ status: 'published', isActive: true }),
      Story.countDocuments({ isPublished: true }),
      Event.find({ status: 'published', startDate: { $gte: now } })
        .select(EVENT_PROJECTION)
        .sort({ startDate: 1 })
        .limit(3)
        .lean(),
      Story.find({ isPublished: true })
        .select(STORY_PROJECTION)
        .populate('author', 'name profile.profileImage profile.profileImageThumbnail')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
      User.find({
        isActive: true,
        'profile.title': { $exists: true, $ne: '' }
      })
        .select(ALUMNI_PROJECTION)
        .sort({ createdAt: -1 })
        .limit(4)
        .lean()
    ]);

    res.json({
      stats: {
        members: memberCount,
        jobs: jobCount,
        stories: storyCount,
        upcomingEvents: upcomingEvents.length
      },
      upcomingEvents: upcomingEvents.map(function (event) {
        return {
          id: event._id,
          title: event.title,
          type: event.type,
          date: event.startDate,
          venue: event.location && event.location.venue,
          city: event.location && event.location.city,
          image: event.images && event.images.length ? event.images[0] : null
        };
      }),
      latestStories: latestStories.map(function (story) {
        return {
          id: story._id,
          title: story.title,
          excerpt: story.excerpt,
          category: story.category,
          createdAt: story.createdAt,
          image: story.image,
          author: story.author ? {
            name: story.author.name,
            image: (story.author.profile && (story.author.profile.profileImageThumbnail || story.author.profile.profileImage)) || null
          } : null
        };
      }),
      featuredAlumni: featuredAlumni.map(function (user) {
        return {
          id: user._id,
          name: user.name,
          title: user.profile.title,
          company: user.profile.company,
          graduationYear: user.profile.graduationYear,
          openToMentorship: !!user.profile.openToMentorship,
          image: user.profile.profileImageThumbnail || user.profile.profileImage
        };
      })
    });
  } catch (error) {
    console.error('Get home data error:', error);
    res.status(500).json({ error: 'Failed to load homepage data' });
  }
});

module.exports = router;
