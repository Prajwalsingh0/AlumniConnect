const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  company: {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    description: String,
    website: String,
    logo: String,
    location: {
      city: String,
      state: String,
      country: String
    },
    size: {
      type: String,
      enum: ['startup', 'small', 'medium', 'large', 'enterprise']
    },
    industry: String
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  requirements: {
    type: String,
    required: [true, 'Job requirements are required'],
    maxlength: [3000, 'Requirements cannot exceed 3000 characters']
  },
  responsibilities: {
    type: String,
    maxlength: [3000, 'Responsibilities cannot exceed 3000 characters']
  },
  type: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance', 'remote'],
    required: true
  },
  experience: {
    minimum: {
      type: Number,
      default: 0
    },
    maximum: Number,
    level: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'executive'],
      default: 'entry'
    }
  },
  salary: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    period: {
      type: String,
      enum: ['hourly', 'monthly', 'yearly'],
      default: 'yearly'
    },
    negotiable: {
      type: Boolean,
      default: true
    }
  },
  skills: {
    required: [String],
    preferred: [String]
  },
  benefits: [String],
  education: {
    minimum: {
      type: String,
      enum: ['high-school', 'associate', 'bachelor', 'master', 'phd']
    },
    field: String
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applications: [{
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'],
      default: 'pending'
    },
    coverLetter: String,
    resume: String
  }],
  deadline: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  tags: [String],
  remote: {
    type: Boolean,
    default: false
  },
  urgent: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'closed', 'filled'],
    default: 'published'
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
jobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
jobSchema.index({ createdAt: -1, status: 1 });
jobSchema.index({ type: 1, 'company.location': 1 });
jobSchema.index({ 'experience.level': 1 });
jobSchema.index({ postedBy: 1 });
jobSchema.index({ deadline: 1 });

module.exports = mongoose.model('Job', jobSchema);