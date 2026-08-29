const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const { authenticateToken } = require('../middleware/auth');

// Get all active campaigns
router.get('/campaigns', async (req, res) => {
    try {
        const campaigns = await Campaign.find({ status: 'active' }).sort({ createdAt: -1 });
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a campaign (Admin only in production, but open for now)
router.post('/campaigns', authenticateToken, async (req, res) => {
    try {
        const campaign = new Campaign({
            ...req.body,
            createdBy: req.user.userId
        });
        await campaign.save();
        res.status(201).json(campaign);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Donate to a campaign
router.post('/donate', authenticateToken, async (req, res) => {
    try {
        const { campaignId, amount, isAnonymous, message } = req.body;

        if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'Donation amount must be a positive number' });
        }

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

        const donation = new Donation({
            donor: req.user.userId,
            campaign: campaignId,
            amount,
            isAnonymous,
            message,
            paymentStatus: 'completed' // In a real app, this would be updated after webhook
        });

        await donation.save();

        // Update campaign amount
        campaign.currentAmount += amount;
        await campaign.save();

        res.status(201).json(donation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
