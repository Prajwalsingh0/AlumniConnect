const mongoose = require('mongoose');

const SESSION_STATUSES = ['proposed', 'confirmed', 'declined', 'cancelled'];

const mentorshipSessionSchema = new mongoose.Schema({
  mentorship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentorship',
    required: true,
    index: true
  },
  proposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  durationMinutes: {
    type: Number,
    default: 60,
    min: 15,
    max: 480
  },
  agenda: {
    type: String,
    trim: true,
    maxlength: 300
  },
  meetingLink: {
    type: String,
    trim: true,
    maxlength: 300
  },
  status: {
    type: String,
    enum: SESSION_STATUSES,
    default: 'proposed',
    index: true
  },
  respondedAt: Date
}, {
  timestamps: true
});

// The dashboard asks for "sessions of this mentorship, soonest first"
mentorshipSessionSchema.index({ mentorship: 1, scheduledFor: 1 });
// and for "my upcoming sessions"
mentorshipSessionSchema.index({ status: 1, scheduledFor: 1 });

const MentorshipSession = mongoose.model('MentorshipSession', mentorshipSessionSchema);

module.exports = { MentorshipSession, SESSION_STATUSES };
