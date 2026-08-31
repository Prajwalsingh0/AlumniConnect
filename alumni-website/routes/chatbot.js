const express = require('express');
const chatbotService = require('../services/chatbotService');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

// Simple in-memory per-user throttle (no external dependency needed).
// enough for a single-process deployment; protects the AI provider budget.
const rateBuckets = new Map();

function isRateLimited(userId) {
    const now = Date.now();
    let bucket = rateBuckets.get(userId);

    if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
        bucket = { windowStart: now, count: 0 };
        rateBuckets.set(userId, bucket);
    }

    bucket.count += 1;

    // Keep the map bounded: drop stale buckets occasionally
    if (rateBuckets.size > 1000) {
        for (const [key, value] of rateBuckets) {
            if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
                rateBuckets.delete(key);
            }
        }
    }

    return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

// Ask the AlumniConnect assistant
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;

        if (typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Please type a question for the assistant.' });
        }

        const trimmed = message.trim();
        if (trimmed.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ error: `Message is too long (maximum ${MAX_MESSAGE_LENGTH} characters).` });
        }

        if (isRateLimited(req.user.userId)) {
            return res.status(429).json({ error: 'You are sending questions too quickly. Please wait a moment.' });
        }

        const reply = await chatbotService.getChatbotReply(trimmed);

        res.json({ reply });
    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({ error: 'The assistant is unavailable right now. Please try again later.' });
    }
});

module.exports = router;
