const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const upload = require('../middleware/upload');
const { processImage, generateThumbnail } = require('../services/imageService');
const path = require('path');
const router = express.Router();

// Validation middleware
const validateProfileUpdate = [
  body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('phone').optional().trim().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('graduationYear').optional().isInt({ min: 1900, max: new Date().getFullYear() + 10 }).withMessage('Please provide a valid graduation year'),
  body('linkedin').optional({ checkFalsy: true }).isURL({ require_protocol: false }).withMessage('Please provide a valid LinkedIn URL'),
  body('twitter').optional({ checkFalsy: true }).isURL({ require_protocol: false }).withMessage('Please provide a valid Twitter URL'),
  body('github').optional({ checkFalsy: true }).isURL({ require_protocol: false }).withMessage('Please provide a valid GitHub URL'),
];

const validatePasswordChange = [
  body('currentPassword').exists().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  body('confirmPassword').exists().withMessage('Please confirm your new password')
];

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user data without password
    const userResponse = user.getPublicProfile();

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, validateProfileUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.user;
    const allowedProfileUpdates = [
      'title', 'company', 'location', 'phone', 'graduationYear',
      'department', 'degree', 'bio', 'bannerImage', 'linkedin',
      'twitter', 'github', 'website', 'seeking'
    ];

    const updates = {};

    // Handle top-level 'name' field separately (it's not inside profile)
    if (req.body.name !== undefined && req.body.name.trim().length >= 2) {
      updates['name'] = req.body.name.trim();
    }

    allowedProfileUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[`profile.${field}`] = req.body[field];
      }
    });

    // Handle nested arrays (Experience, Education, etc.)
    if (req.body.workHistory) updates['profile.workHistory'] = req.body.workHistory;
    if (req.body.education) updates['profile.education'] = req.body.education;
    if (req.body.campusInvolvement) updates['profile.campusInvolvement'] = req.body.campusInvolvement;
    if (req.body.projects) updates['profile.projects'] = req.body.projects;
    if (req.body.languages) updates['profile.languages'] = req.body.languages;
    if (req.body.volunteerExperience) updates['profile.volunteerExperience'] = req.body.volunteerExperience;
    if (req.body.skills && Array.isArray(req.body.skills)) {
      // Initialize skills with empty endorsements if they don't exist
      updates['profile.skills'] = req.body.skills.map(s => ({
        name: s.name || s,
        level: s.level || 'Intermediate',
        endorsements: s.endorsements || []
      }));
    }

    // Update privacy settings
    if (req.body.privacySettings) {
      Object.keys(req.body.privacySettings).forEach(key => {
        updates[`privacySettings.${key}`] = req.body.privacySettings[key];
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: false }
    );

    const userResponse = updatedUser.getPublicProfile();

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update profile error:', error.message, error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

// Endorse a skill
router.post('/skills/:skillName/endorse', authenticateToken, async (req, res) => {
  try {
    const { skillName } = req.params;
    const { targetUserId } = req.body;

    if (targetUserId === req.user.userId) {
      return res.status(400).json({ error: 'You cannot endorse your own skills' });
    }

    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const skillIndex = user.profile.skills.findIndex(s => s.name.toLowerCase() === skillName.toLowerCase());
    if (skillIndex === -1) return res.status(404).json({ error: 'Skill not found on this profile' });

    const endorsements = user.profile.skills[skillIndex].endorsements;
    const alreadyEndorsed = endorsements.includes(req.user.userId);

    if (alreadyEndorsed) {
      // Remove endorsement (toggle)
      user.profile.skills[skillIndex].endorsements = endorsements.filter(id => id.toString() !== req.user.userId);
    } else {
      // Add endorsement
      user.profile.skills[skillIndex].endorsements.push(req.user.userId);
    }

    await user.save();
    res.json({
      message: alreadyEndorsed ? 'Endorsement removed' : 'Skill endorsed successfully',
      endorsementsCount: user.profile.skills[skillIndex].endorsements.length
    });

  } catch (error) {
    console.error('Endorsement error:', error);
    res.status(500).json({ error: 'Failed to process endorsement' });
  }
});

// Get public profile with privacy filtering
router.get('/public/:userId', authenticateToken, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Determine whether the requester may see restricted sections.
    // The project has no connections feature yet, so only the alumni/admin check applies;
    // sections marked "Connections Only" stay hidden.
    const isConnection = false;
    const isAlumni = req.user.role === 'alumni' || req.user.role === 'admin';

    const profile = targetUser.toObject();
    const result = {
      _id: profile._id,
      name: profile.name,
      role: profile.role,
      profile: {
        title: profile.profile.title,
        company: profile.profile.company,
        graduationYear: profile.profile.graduationYear,
        verificationBadge: profile.profile.verificationBadge
      }
    };

    // Filter sections based on privacy settings
    const checkPrivacy = (section) => {
      const setting = targetUser.privacySettings[section] || 'Public';
      if (setting === 'Public') return true;
      if (setting === 'Alumni Only' && isAlumni) return true;
      if (setting === 'Connections Only' && isConnection) return true;
      return false;
    };

    if (checkPrivacy('profilePhoto')) {
      result.profile.profileImage = profile.profile.profileImage;
    }

    if (checkPrivacy('contactInfo')) {
      result.email = profile.email;
      result.profile.phone = profile.profile.phone;
      result.profile.linkedin = profile.profile.linkedin;
      result.profile.website = profile.profile.website;
    }

    if (checkPrivacy('workHistory')) {
      result.profile.workHistory = profile.profile.workHistory;
    }

    if (checkPrivacy('education')) {
      result.profile.education = profile.profile.education;
    }

    if (checkPrivacy('skills')) {
      result.profile.skills = profile.profile.skills;
    }

    res.json({ profile: result });

  } catch (error) {
    console.error('Public profile error:', error);
    res.status(500).json({ error: 'Failed to get public profile' });
  }
});

// Change password
router.put('/password', authenticateToken, validatePasswordChange, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password (this will be automatically hashed by the pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Upload profile image (Enhanced)
router.post('/profile/image', authenticateToken, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Process image
    const processedPath = await processImage(req.file.path, {
      width: 400,
      height: 400,
      quality: 85
    });

    // Generate thumbnail
    const thumbnailPath = await generateThumbnail(processedPath);

    // Update user profile
    const imageUrl = `/uploads/${path.basename(processedPath)}`;
    const thumbnailUrl = `/uploads/${path.basename(thumbnailPath)}`;

    user.profile.profileImage = imageUrl;
    user.profile.profileImageThumbnail = thumbnailUrl;

    // If user has old base64 image, it will be overwritten
    // If we had old file system images, we should delete them here

    await user.save();

    res.json({
      message: 'Profile image updated successfully',
      imageUrl,
      thumbnailUrl
    });

  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

// ── Alumni directory helpers ─────────────────────────────────────────────────

// Escape user input so it is treated literally inside $regex queries
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DIRECTORY_SORTS = {
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  newest: { createdAt: -1 },
  grad_year: { 'profile.graduationYear': -1 }
};

// Only public directory information is fetched from MongoDB
const DIRECTORY_PROJECTION = {
  name: 1,
  role: 1,
  createdAt: 1,
  'profile.title': 1,
  'profile.company': 1,
  'profile.location': 1,
  'profile.graduationYear': 1,
  'profile.department': 1,
  'profile.degree': 1,
  'profile.profileImage': 1,
  'profile.profileImageThumbnail': 1,
  'profile.skills.name': 1,
  'profile.skills.level': 1
};

const DIRECTORY_MAX_LIMIT = 48;

// Build the MongoDB filter for the directory from validated query params.
// Throws { status, message } on invalid input.
function buildDirectoryFilter(query) {
  const filter = { isActive: true };

  // Free-text search across real User schema fields
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q) {
    if (q.length > 100) {
      throw { status: 400, message: 'Search query is too long' };
    }
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [
      { name: pattern },
      { 'profile.title': pattern },
      { 'profile.company': pattern },
      { 'profile.degree': pattern },
      { 'profile.department': pattern },
      { 'profile.location': pattern },
      { 'profile.skills.name': pattern }
    ];
  }

  // Structured filters (exact, case-insensitive matches on schema fields)
  if (query.graduationYear !== undefined && query.graduationYear !== '') {
    const year = Number(query.graduationYear);
    const maxYear = new Date().getFullYear() + 10;
    if (!Number.isInteger(year) || year < 1900 || year > maxYear) {
      throw { status: 400, message: 'graduationYear must be a valid year' };
    }
    filter['profile.graduationYear'] = year;
  }

  ['department', 'degree', 'location'].forEach((field) => {
    const value = query[field];
    if (value !== undefined && value !== '') {
      if (typeof value !== 'string' || value.trim().length === 0 || value.length > 100) {
        throw { status: 400, message: `${field} filter is invalid` };
      }
      filter[`profile.${field}`] = new RegExp(`^${escapeRegex(value.trim())}$`, 'i');
    }
  });

  return filter;
}

// Alumni directory: paginated, searchable, filterable member listing
router.get('/directory', authenticateToken, async (req, res) => {
  try {
    // Validate pagination parameters
    let page = 1;
    if (req.query.page !== undefined && req.query.page !== '') {
      page = Number(req.query.page);
      if (!Number.isInteger(page) || page < 1) {
        return res.status(400).json({ error: 'page must be a positive integer' });
      }
    }

    let limit = 12;
    if (req.query.limit !== undefined && req.query.limit !== '') {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > DIRECTORY_MAX_LIMIT) {
        return res.status(400).json({ error: `limit must be an integer between 1 and ${DIRECTORY_MAX_LIMIT}` });
      }
    }

    const sortKey = req.query.sort === undefined || req.query.sort === '' ? 'name_asc' : req.query.sort;
    const sort = DIRECTORY_SORTS[sortKey];
    if (!sort) {
      return res.status(400).json({ error: 'sort must be one of: name_asc, name_desc, newest, grad_year' });
    }

    let filter;
    try {
      filter = buildDirectoryFilter(req.query);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(DIRECTORY_PROJECTION)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get directory error:', error);
    res.status(500).json({ error: 'Failed to get user directory' });
  }
});

// Distinct filter values for the directory, derived from real active user data
router.get('/directory/facets', authenticateToken, async (req, res) => {
  try {
    const [departments, degrees, locations, graduationYears] = await Promise.all([
      User.distinct('profile.department', { isActive: true }),
      User.distinct('profile.degree', { isActive: true }),
      User.distinct('profile.location', { isActive: true }),
      User.distinct('profile.graduationYear', { isActive: true })
    ]);

    const cleanStrings = (values) => values
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
      .map((v) => String(v).trim())
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b));

    res.json({
      departments: cleanStrings(departments),
      degrees: cleanStrings(degrees),
      locations: cleanStrings(locations),
      graduationYears: graduationYears
        .filter((y) => Number.isInteger(y))
        .sort((a, b) => b - a)
    });
  } catch (error) {
    console.error('Get directory facets error:', error);
    res.status(500).json({ error: 'Failed to get directory filters' });
  }
});

// Search users (kept for backward compatibility; the directory endpoint
// supports the same text search combined with filters and pagination)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const raw = req.query.query !== undefined ? req.query.query : req.query.q;

    if (raw === undefined || String(raw).trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchTerm = String(raw).trim();
    if (searchTerm.length > 100) {
      return res.status(400).json({ error: 'Search query is too long' });
    }

    const pattern = new RegExp(escapeRegex(searchTerm), 'i');
    const searchQuery = {
      isActive: true,
      $or: [
        { name: pattern },
        { 'profile.degree': pattern },
        { 'profile.company': pattern },
        { 'profile.department': pattern },
        { 'profile.location': pattern },
        { 'profile.skills.name': pattern }
      ]
    };

    const filteredUsers = await User.find(searchQuery)
      .select(DIRECTORY_PROJECTION)
      .sort({ name: 1 })
      .limit(100)
      .lean();

    res.json({ users: filteredUsers });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;