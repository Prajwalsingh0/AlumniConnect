const express = require('express');
const mongoose = require('mongoose');
const Story = require('../models/Story');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Allowed categories must match the Story model enum
const STORY_CATEGORIES = [
  'Career',
  'Academic',
  'Entrepreneurship',
  'Personal Growth',
  'Technology',
  'Other'
];

// Get published stories (optionally only featured ones)
router.get('/', async (req, res) => {
  try {
    const filter = { isPublished: true };
    if (req.query.featured === 'true') {
      filter.isFeatured = true;
    }

    const stories = await Story.find(filter)
      .populate('author', 'name profile.profileImage profile.profileImageThumbnail profile.graduationYear profile.title')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ stories });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ error: 'Failed to get stories' });
  }
});

// Get single story by ID (increments view counter)
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const story = await Story.findOne({ _id: req.params.id, isPublished: true })
      .populate('author', 'name profile.profileImage profile.profileImageThumbnail profile.graduationYear profile.title');

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    await story.incrementViews();

    res.json({ story });
  } catch (error) {
    console.error('Get story error:', error);
    res.status(500).json({ error: 'Failed to get story' });
  }
});

// Submit a new story (must be logged in; the submitted story is published under the logged-in account)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, content, category, tags, achievements } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Story title is required' });
    }
    if (!content || content.trim().length < 100) {
      return res.status(400).json({ error: 'Story content is required (minimum 100 characters)' });
    }

    // Combine the main story and the optional achievements into the content
    let fullContent = content.trim();
    if (achievements && achievements.trim()) {
      fullContent += `\n\nKey Achievements:\n${achievements.trim()}`;
    }

    // Derive the excerpt from the content (the model requires one, max 200 chars)
    const excerpt = fullContent.replace(/\s+/g, ' ').trim().substring(0, 197) + '...';

    const selectedCategory = STORY_CATEGORIES.includes(category) ? category : 'Other';

    const story = new Story({
      title: title.trim(),
      content: fullContent,
      excerpt,
      author: req.user.userId,
      category: selectedCategory,
      tags: Array.isArray(tags) ? tags.filter(t => typeof t === 'string' && t.trim()).slice(0, 10) : [],
      isPublished: true
    });

    await story.save();

    res.status(201).json({
      message: 'Story submitted successfully. Thank you for sharing!',
      story
    });
  } catch (error) {
    console.error('Submit story error:', error);
    res.status(500).json({ error: 'Failed to submit story' });
  }
});

module.exports = router;
