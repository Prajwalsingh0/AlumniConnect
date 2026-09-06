const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const isValidObjectId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

// List the authenticated user's notifications (newest first)
router.get('/', authenticateToken, async (req, res) => {
    try {
        let page = 1;
        if (req.query.page !== undefined && req.query.page !== '') {
            page = Number(req.query.page);
            if (!Number.isInteger(page) || page < 1) {
                return res.status(400).json({ error: 'page must be a positive integer' });
            }
        }

        let limit = DEFAULT_LIMIT;
        if (req.query.limit !== undefined && req.query.limit !== '') {
            limit = Number(req.query.limit);
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
                return res.status(400).json({ error: `limit must be an integer between 1 and ${MAX_LIMIT}` });
            }
        }

        const filter = { recipient: req.user.userId };
        if (req.query.unread === 'true') {
            filter.read = false;
        }

        const [notifications, total] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter)
        ]);

        res.json({
            notifications,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('List notifications error:', error);
        res.status(500).json({ error: 'Failed to load notifications' });
    }
});

// Unread total for the navbar bell
router.get('/unread/count', authenticateToken, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user.userId,
            read: false
        });
        res.json({ count });
    } catch (error) {
        console.error('Notification count error:', error);
        res.status(500).json({ error: 'Failed to count notifications' });
    }
});

// Mark one notification as read (owner only; unknown/foreign ids -> 404)
router.post('/:id/read', authenticateToken, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid notification id' });
        }

        const notification = await Notification.findOne({
            _id: req.params.id,
            recipient: req.user.userId
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        if (!notification.read) {
            notification.read = true;
            notification.readAt = new Date();
            await notification.save();
        }

        res.json({ notification });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Mark all of the user's notifications as read
router.post('/read-all', authenticateToken, async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { recipient: req.user.userId, read: false },
            { $set: { read: true, readAt: new Date() } }
        );
        res.json({ modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

module.exports = router;
