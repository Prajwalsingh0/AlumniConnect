const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const Event = require('../models/Event');
const User = require('../models/User');
const router = express.Router();

// Get all published or completed events
router.get('/', async (req, res) => {
  try {
    const { category, type, search } = req.query;
    let filter = { status: { $in: ['published', 'completed'] } }; // Show published and completed events publicly

    if (category) filter.category = category;
    if (type) filter.type = type;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const events = await Event.find(filter)
      .populate('organizer', 'name email')
      .sort({ startDate: 1 })
      .lean();

    // Map _id to id for frontend compatibility
    const mappedEvents = events.map(ev => ({
        ...ev,
        id: ev._id.toString(),
        date: ev.startDate
    }));

    res.json({ events: mappedEvents });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// Get single event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'name email')
      .lean();
    
    if (!event || !['published', 'completed'].includes(event.status)) {
      return res.status(404).json({ error: 'Event not found or not public' });
    }

    const registrationCount = event.attendees ? event.attendees.length : 0;
    const spotsLeft = event.maxAttendees ? event.maxAttendees - registrationCount : null;

    res.json({ 
      event: {
        ...event,
        id: event._id.toString(),
        date: event.startDate,
        registrationCount,
        spotsLeft
      }
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
});

// Register for event
router.post('/:id/register', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.status !== 'published') {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.startDate < new Date()) {
      return res.status(400).json({ error: 'Cannot register for past events' });
    }

    // Check if already registered
    const existing = event.attendees.find(a => a.user.toString() === req.user.userId);
    if (existing) {
      return res.status(400).json({ error: 'Already registered for this event' });
    }

    // Check capacity
    if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
      return res.status(400).json({ error: 'Event is full' });
    }

    event.attendees.push({
      user: req.user.userId,
      registeredAt: new Date()
    });
    await event.save();

    res.json({ message: 'Successfully registered for event' });

  } catch (error) {
    console.error('Register event error:', error);
    res.status(500).json({ error: 'Failed to register for event' });
  }
});

// Unregister from event
router.delete('/:id/register', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const idx = event.attendees.findIndex(a => a.user.toString() === req.user.userId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    event.attendees.splice(idx, 1);
    await event.save();

    res.json({ message: 'Successfully unregistered from event' });
  } catch (error) {
    console.error('Unregister event error:', error);
    res.status(500).json({ error: 'Failed to unregister from event' });
  }
});

// Get user's registered events
router.get('/user/registrations', authenticateToken, async (req, res) => {
  try {
    const events = await Event.find({ 'attendees.user': req.user.userId }).lean();
    const mapped = events.map(ev => ({
        eventId: ev._id.toString(),
        userId: req.user.userId,
        event: { ...ev, id: ev._id.toString(), date: ev.startDate }
    }));
    res.json({ registrations: mapped });
  } catch (error) {
    console.error('Get user registrations error:', error);
    res.status(500).json({ error: 'Failed to get user registrations' });
  }
});

module.exports = router;