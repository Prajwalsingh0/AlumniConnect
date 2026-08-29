const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all jobs
router.get('/', async (req, res) => {
    try {
        const { search, type, level, location, remote } = req.query;
        let query = { status: 'published', isActive: true };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { 'company.name': { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        if (type) query.type = type;
        if (level) query['experience.level'] = level;
        if (location) query['company.location.city'] = { $regex: location, $options: 'i' };
        if (remote === 'true') query.remote = true;

        const jobs = await Job.find(query)
            .populate('postedBy', 'name profile.profileImage')
            .sort({ createdAt: -1 });

        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Post a new job
router.post('/', authenticateToken, async (req, res) => {
    try {
        const job = new Job({
            ...req.body,
            postedBy: req.user.userId
        });
        await job.save();
        res.status(201).json(job);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Apply for a job
router.post('/:id/apply', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Check if already applied
        const alreadyApplied = job.applications.some(app => app.applicant.toString() === req.user.userId);
        if (alreadyApplied) return res.status(400).json({ error: 'Already applied for this job' });

        job.applications.push({
            applicant: req.user.userId,
            coverLetter: req.body.coverLetter,
            resume: req.body.resume
        });

        await job.save();
        res.json({ message: 'Application submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get job by ID
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const job = await Job.findById(req.params.id).populate('postedBy', 'name profile');
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Increment views
        job.views += 1;
        await job.save();

        res.json(job);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
