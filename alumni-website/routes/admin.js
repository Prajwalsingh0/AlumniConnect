const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Event = require('../models/Event');
const Job = require('../models/Job');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');
const { authenticateToken } = require('../middleware/auth');

// ── Admin check middleware ────────────────────────────────────────────────────
const isAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (user && user.role === 'admin') {
            req.adminUser = user;
            next();
        } else {
            res.status(403).json({ error: 'Admin access denied' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [userCount, activeUsers, bannedUsers, eventCount, jobCount, totalDonations] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isActive: true }),
            User.countDocuments({ isActive: false }),
            Event.countDocuments(),
            Job.countDocuments(),
            Donation.aggregate([
                { $match: { paymentStatus: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        res.json({
            users: userCount,
            activeUsers,
            bannedUsers,
            events: eventCount,
            jobs: jobCount,
            donations: totalDonations[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /api/admin/users ─────────────────────────────────────────────────────
// Query params: page, limit, search, role, status
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const page   = parseInt(req.query.page)  || 1;
        const limit  = parseInt(req.query.limit) || 15;
        const skip   = (page - 1) * limit;
        const search = req.query.search || '';
        const role   = req.query.role   || '';
        const status = req.query.status || ''; // 'active' | 'banned'

        // Build filter
        const filter = {};
        if (search) {
            filter.$or = [
                { name:  { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'profile.department': { $regex: search, $options: 'i' } }
            ];
        }
        if (role)   filter.role     = role;
        if (status === 'active')  filter.isActive = true;
        if (status === 'banned')  filter.isActive = false;

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('-password -emailVerificationToken -passwordResetToken -twoFactorSecret')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        res.json({
            users,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── PATCH /api/admin/users/:id/role ─────────────────────────────────────────
router.patch('/users/:id/role', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['alumni', 'student', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be: alumni, student, admin' });
        }
        // Prevent removing own admin
        if (req.params.id === req.user.userId && role !== 'admin') {
            return res.status(400).json({ error: 'Cannot demote yourself' });
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: `Role updated to ${role}`, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── PATCH /api/admin/users/:id/ban ──────────────────────────────────────────
router.patch('/users/:id/ban', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user.userId) {
            return res.status(400).json({ error: 'Cannot ban yourself' });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.isActive = !user.isActive; // toggle
        await user.save();

        const action = user.isActive ? 'unbanned' : 'banned';
        res.json({ message: `User ${action} successfully`, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── DELETE /api/admin/users/:id ──────────────────────────────────────────────
router.delete('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user.userId) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted permanently' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ── GET /api/admin/events ────────────────────────────────────────────────────
// Query: page, limit, search, status
router.get('/events', authenticateToken, isAdmin, async (req, res) => {
    try {
        const page   = parseInt(req.query.page)  || 1;
        const limit  = parseInt(req.query.limit) || 10;
        const skip   = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const filter = {};
        if (search) {
            filter.$or = [
                { title:       { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'location.city': { $regex: search, $options: 'i' } }
            ];
        }
        if (status) filter.status = status;

        const [events, total] = await Promise.all([
            Event.find(filter)
                .populate('organizer', 'name email')
                .sort({ startDate: -1 })
                .skip(skip).limit(limit).lean(),
            Event.countDocuments(filter)
        ]);

        res.json({
            events,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── POST /api/admin/events ───────────────────────────────────────────────────
router.post('/events', authenticateToken, isAdmin, async (req, res) => {
    try {
        const event = new Event({
            ...req.body,
            organizer: req.user.userId
        });
        await event.save();
        res.status(201).json({ message: 'Event created successfully', event });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ── PUT /api/admin/events/:id ────────────────────────────────────────────────
router.put('/events/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const event = await Event.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json({ message: 'Event updated successfully', event });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ── PATCH /api/admin/events/:id/status ──────────────────────────────────────
router.patch('/events/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['draft', 'published', 'cancelled', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const event = await Event.findByIdAndUpdate(
            req.params.id,
            { status, updatedAt: Date.now() },
            { new: true }
        );
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json({ message: `Event ${status}`, event });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── DELETE /api/admin/events/:id ─────────────────────────────────────────────
router.delete('/events/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json({ message: 'Event deleted permanently' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /api/admin/jobs ──────────────────────────────────────────────────────
// Query: page, limit, search, status, type
router.get('/jobs', authenticateToken, isAdmin, async (req, res) => {
    try {
        const page   = parseInt(req.query.page)  || 1;
        const limit  = parseInt(req.query.limit) || 10;
        const skip   = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const type   = req.query.type   || '';

        const filter = {};
        if (search) {
            filter.$or = [
                { title:        { $regex: search, $options: 'i' } },
                { 'company.name': { $regex: search, $options: 'i' } },
                { description:  { $regex: search, $options: 'i' } }
            ];
        }
        if (status) filter.status = status;
        if (type)   filter.type   = type;

        const [jobs, total] = await Promise.all([
            Job.find(filter)
                .populate('postedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip).limit(limit).lean(),
            Job.countDocuments(filter)
        ]);

        res.json({
            jobs,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── POST /api/admin/jobs ──────────────────────────────────────────────────────
router.post('/jobs', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { title, companyName, companyWebsite, description, requirements,
                type, location, salaryMin, salaryMax, experience, status } = req.body;

        if (!title || !companyName || !description || !requirements || !type) {
            return res.status(400).json({ error: 'Title, company, description, requirements and type are required' });
        }

        const job = new Job({
            title: title.trim(),
            company: {
                name: companyName.trim(),
                website: companyWebsite || '',
                location: { city: location || '' }
            },
            description,
            requirements,
            type,
            experience: { minimum: parseInt(experience) || 0 },
            status: status || 'published',
            isActive: true,
            postedBy: req.user.userId
        });

        if (salaryMin) {
            job.salary = { min: parseInt(salaryMin), max: parseInt(salaryMax) || undefined, currency: 'INR', period: 'yearly' };
        }

        await job.save();
        res.status(201).json({ message: 'Job posted successfully', job });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ── PATCH /api/admin/jobs/:id/status ─────────────────────────────────────────
router.patch('/jobs/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['draft', 'published', 'closed', 'filled'];
        if (!valid.includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Valid: draft, published, closed, filled' });
        }
        const job = await Job.findByIdAndUpdate(
            req.params.id,
            { status, updatedAt: Date.now() },
            { new: true }
        );
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json({ message: `Job marked as ${status}`, job });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── PATCH /api/admin/jobs/:id/feature ────────────────────────────────────────
router.patch('/jobs/:id/feature', authenticateToken, isAdmin, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        job.isFeatured = !job.isFeatured;
        job.updatedAt  = Date.now();
        await job.save();
        res.json({ message: `Job ${job.isFeatured ? 'featured' : 'unfeatured'}`, isFeatured: job.isFeatured });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── DELETE /api/admin/jobs/:id ────────────────────────────────────────────────
router.delete('/jobs/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const job = await Job.findByIdAndDelete(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        res.json({ message: 'Job deleted permanently' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── GET /api/admin/campaigns ──────────────────────────────────────────────────
router.get('/campaigns', authenticateToken, isAdmin, async (req, res) => {
    try {
        const campaigns = await Campaign.find().sort({ createdAt: -1 }).populate('createdBy', 'name email');
        res.json({ campaigns });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── POST /api/admin/campaigns ─────────────────────────────────────────────────
router.post('/campaigns', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { title, description, goalAmount, endDate, category, status } = req.body;
        const campaign = new Campaign({
            title,
            description,
            goalAmount,
            endDate,
            category: category || 'other',
            status: status || 'active',
            createdBy: req.user.userId
        });
        await campaign.save();
        res.status(201).json({ message: 'Campaign created successfully', campaign });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ── PATCH /api/admin/campaigns/:id/status ─────────────────────────────────────
router.patch('/campaigns/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const valid = ['active', 'completed', 'cancelled', 'draft'];
        if (!valid.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const campaign = await Campaign.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        res.json({ message: `Campaign marked as ${status}`, campaign });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── DELETE /api/admin/campaigns/:id ───────────────────────────────────────────
router.delete('/campaigns/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const campaign = await Campaign.findByIdAndDelete(req.params.id);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        // Optionally delete associated donations, but let's keep it simple
        res.json({ message: 'Campaign deleted permanently' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
