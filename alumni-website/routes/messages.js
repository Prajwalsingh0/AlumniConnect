const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { authenticateToken } = require('../middleware/auth');

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

// Get messages in a conversation
router.get('/conversations/:conversationId', authenticateToken, async (req, res) => {
    try {
        const messages = await Message.find({
            conversationId: req.params.conversationId,
            deletedBy: { $ne: req.user.userId }
        })
            .sort({ createdAt: 1 })
            .populate('sender', 'name profile.profileImage');

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start or get a conversation with a user
router.post('/conversations', authenticateToken, async (req, res) => {
    try {
        const { recipientId } = req.body;

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
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
