const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  mentorship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mentorship',
    required: true
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// One review per participant per mentorship (either direction)
reviewSchema.index({ mentorship: 1, reviewer: 1 }, { unique: true });

// Aggregates and "latest reviews" for a member
reviewSchema.index({ reviewee: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
