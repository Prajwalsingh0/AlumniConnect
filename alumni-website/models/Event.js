const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  type: {
    type: String,
    enum: ['networking', 'workshop', 'seminar', 'reunion', 'career', 'social', 'other'],
    default: 'other'
  },
  category: {
    type: String,
    enum: ['technology', 'business', 'arts', 'sports', 'academic', 'social', 'other'],
    default: 'other'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  location: {
    venue: String,
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  isVirtual: {
    type: Boolean,
    default: false
  },
  virtualLink: String,
  maxAttendees: {
    type: Number,
    default: null
  },
  registrationRequired: {
    type: Boolean,
    default: true
  },
  registrationDeadline: Date,
  price: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  speakers: [{
    name: String,
    title: String,
    company: String,
    bio: String,
    photo: String
  }],
  tags: [String],
  requirements: [String],
  agenda: [{
    time: String,
    title: String,
    description: String,
    speaker: String
  }],
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['registered', 'attended', 'cancelled'],
      default: 'registered'
    }
  }],
  images: [String],
  documents: [{
    name: String,
    url: String,
    type: String
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'alumni', 'students', 'private'],
    default: 'public'
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt timestamp
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
eventSchema.index({ startDate: 1, status: 1 });
eventSchema.index({ type: 1, category: 1 });
eventSchema.index({ 'attendees.user': 1 });

module.exports = mongoose.model('Event', eventSchema);