const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const MESSAGES_MAX_LIMIT = 50;
const MESSAGES_DEFAULT_LIMIT = 30;

const isValidObjectId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

// Find a conversation the authenticated user participates in.
// Non-participants and unknown ids both get 404 so outsider ID probing
// cannot reveal whether a conversation exists.
async function findConversationForUser(req) {
    if (!isValidObjectId(req.params.conversationId)) {
        return { error: { status: 400, message: 'Invalid conversation id' } };
    }

    const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        participants: req.user.userId
    });

    if (!conversation) {
        return { error: { status: 404, message: 'Conversation not found' } };
    }

    return { conversation };
}

// Get all conversations for current user
router.get('/conversations', authenticateToken, async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user.userId
        })
            .populate('participants', 'name profile.profileImage')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });

        res.json(conversations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unread message total for the authenticated user (navbar badge)
router.get('/unread/count', authenticateToken, async (req, res) => {
    try {
        const count = await Message.countDocuments({
            recipient: req.user.userId,
            read: false,
            deletedBy: { $ne: req.user.userId }
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to count unread messages' });
    }
});

// Get messages in a conversation (cursor paginated: newest page first,
// older pages via ?before=<ISO date of the oldest message already loaded>)
router.get('/conversations/:conversationId', authenticateToken, async (req, res) => {
    try {
        const { conversation, error } = await findConversationForUser(req);
        if (error) {
            return res.status(error.status).json({ error: error.message });
        }

        let limit = MESSAGES_DEFAULT_LIMIT;
        if (req.query.limit !== undefined && req.query.limit !== '') {
            limit = Number(req.query.limit);
            if (!Number.isInteger(limit) || limit < 1 || limit > MESSAGES_MAX_LIMIT) {
                return res.status(400).json({ error: `limit must be an integer between 1 and ${MESSAGES_MAX_LIMIT}` });
            }
        }

        const filter = {
            conversationId: req.params.conversationId,
            deletedBy: { $ne: req.user.userId }
        };

        if (req.query.before !== undefined && req.query.before !== '') {
            const before = new Date(req.query.before);
            if (Number.isNaN(before.getTime())) {
                return res.status(400).json({ error: 'before must be a valid ISO date' });
            }
            filter.createdAt = { $lt: before };
        }

        // Newest page first, then reversed so the client receives
        // ascending order for display.
        const page = await Message.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender', 'name profile.profileImage')
            .lean();

        const messages = page.reverse();
        const hasMore = page.length === limit;

        res.json({
            messages,
            pagination: {
                limit,
                hasMore,
                nextBefore: messages.length ? messages[0].createdAt : null
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load messages' });
    }
});

// Mark all unread messages in a conversation as read (recipient = me)
router.post('/conversations/:conversationId/read', authenticateToken, async (req, res) => {
    try {
        const { conversation, error } = await findConversationForUser(req);
        if (error) {
            return res.status(error.status).json({ error: error.message });
        }

        const now = new Date();
        const result = await Message.updateMany(
            {
                conversationId: conversation._id,
                recipient: req.user.userId,
                read: false
            },
            { $set: { read: true, readAt: now } }
        );

        // Reset my unread counter on the conversation
        conversation.unreadCount.set(req.user.userId, 0);
        await conversation.save();

        // Notify the other participant(s) so their read receipts update live
        const io = req.app.get('io');
        if (io && result.modifiedCount > 0) {
            conversation.participants.forEach((participantId) => {
                const pid = participantId.toString();
                if (pid !== req.user.userId) {
                    io.to(pid).emit('messages_read', {
                        conversationId: conversation._id.toString(),
                        readBy: req.user.userId,
                        readAt: now.toISOString()
                    });
                }
            });
        }

        res.json({ message: 'Messages marked as read', modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

// Start or get a conversation with a user
router.post('/conversations', authenticateToken, async (req, res) => {
    try {
        const { recipientId } = req.body;

        if (!recipientId || !isValidObjectId(recipientId)) {
            return res.status(400).json({ error: 'A valid recipient is required' });
        }
        if (recipientId === req.user.userId.toString()) {
            return res.status(400).json({ error: 'A valid recipient is required' });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        let conversation = await Conversation.findOne({
            participants: { $all: [req.user.userId, recipientId] }
        });

        if (!conversation) {
            conversation = new Conversation({
                participants: [req.user.userId, recipientId]
            });
            await conversation.save();
        }

        res.json(conversation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to open conversation' });
    }
});

module.exports = router;
