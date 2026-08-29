const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['alumni', 'student', 'admin'],
    default: 'alumni'
  },
  profile: {
    title: String,
    company: String,
    location: String,
    phone: String,
    graduationYear: Number,
    department: String,
    degree: String,
    bio: String,
    profileImage: String,
    profileImageThumbnail: String,
    bannerImage: String,
    linkedin: String,
    twitter: String,
    github: String,
    website: String,
    seeking: [String], // Job Opportunities, Networking, Mentorship, etc.
    skills: [{
      name: String,
      level: { type: String, enum: ['Beginner', 'Intermediate', 'Expert', 'Master'], default: 'Intermediate' },
      endorsements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    workHistory: [{
      company: String,
      position: String,
      employmentType: { type: String, enum: ['Full-time', 'Part-time', 'Freelance', 'Intern', 'Owner'] },
      startDate: Date,
      endDate: Date,
      current: Boolean,
      description: String
    }],
    education: [{
      institution: String,
      degree: String,
      fieldOfStudy: String,
      graduationYear: Number,
      achievements: [String]
    }],
    campusInvolvement: [{
      organization: String,
      role: String,
      description: String
    }],
    projects: [{
      title: String,
      description: String,
      role: String,
      link: String
    }],
    languages: [{
      language: String,
      proficiency: { type: String, enum: ['Native', 'Fluent', 'Intermediate', 'Basic'] }
    }],
    volunteerExperience: [{
      organization: String,
      role: String,
      startDate: Date,
      endDate: Date,
      description: String
    }],
    verificationBadge: {
      type: Boolean,
      default: false
    }
  },
  privacySettings: {
    profilePhoto: { type: String, enum: ['Public', 'Alumni Only', 'Connections Only', 'Private'], default: 'Public' },
    contactInfo: { type: String, enum: ['Public', 'Alumni Only', 'Connections Only', 'Private'], default: 'Alumni Only' },
    workHistory: { type: String, enum: ['Public', 'Alumni Only', 'Connections Only', 'Private'], default: 'Public' },
    education: { type: String, enum: ['Public', 'Alumni Only', 'Connections Only', 'Private'], default: 'Public' },
    skills: { type: String, enum: ['Public', 'Alumni Only', 'Connections Only', 'Private'], default: 'Public' },
    activityFeed: { type: String, enum: ['Public', 'Alumni Only', 'Connections Only', 'Private'], default: 'Alumni Only' },
    connectionsList: { type: String, enum: ['Public', 'Alumni Only', 'Connections Only', 'Private'], default: 'Alumni Only' }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update updatedAt timestamp
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (exclude sensitive data)
userSchema.methods.getPublicProfile = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);