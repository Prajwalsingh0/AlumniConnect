const mongoose = require('mongoose');

const mentorshipSchema = new mongoose.Schema({
  mentee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  message: {
    type: String,
    required: [true, 'A short message to the mentor is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  respondedAt: Date,
  completedAt: Date
}, {
  timestamps: true // createdAt / updatedAt
});

// Lookup support for the queries the mentorship API actually runs
mentorshipSchema.index({ mentor: 1, status: 1 });
mentorshipSchema.index({ mentee: 1, status: 1 });
mentorshipSchema.index({ mentor: 1, mentee: 1, status: 1 });

module.exports = mongoose.model('Mentorship', mentorshipSchema);
