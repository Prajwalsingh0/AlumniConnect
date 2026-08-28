const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const ForumPost = require('../models/ForumPost');
const { authenticateToken } = require('../middleware/auth');

// Get all groups
router.get('/', async (req, res) => {
    try {
        const groups = await Group.find({ isPrivate: false }).sort({ name: 1 });
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a group
router.post('/', authenticateToken, async (req, res) => {
    try {
        const group = new Group({
            ...req.body,
            createdBy: req.user.userId,
            members: [{ user: req.user.userId, role: 'admin' }]
        });
        await group.save();
        res.status(201).json(group);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Join a group
router.post('/:id/join', authenticateToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const isMember = group.members.some(m => m.user.toString() === req.user.userId);
        if (isMember) return res.status(400).json({ error: 'Already a member' });

        group.members.push({ user: req.user.userId });
        await group.save();
        res.json({ message: 'Joined group successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get posts in a group
router.get('/:id/posts', async (req, res) => {
    try {
        const posts = await ForumPost.find({ group: req.params.id })
            .populate('author', 'name profile.profileImage')
            .sort({ isPinned: -1, createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a post in a group
router.post('/:id/posts', authenticateToken, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const isMember = group.members.some(m => m.user.toString() === req.user.userId);
        if (!isMember) return res.status(403).json({ error: 'Must be a member to post' });

        const post = new ForumPost({
            ...req.body,
            group: req.params.id,
            author: req.user.userId
        });
        await post.save();
        res.status(201).json(post);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
