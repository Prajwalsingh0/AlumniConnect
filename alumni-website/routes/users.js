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

// Get all users (for alumni directory)
router.get('/directory', authenticateToken, async (req, res) => {
  try {
    const directoryUsers = await User.find({ isActive: true })
      .select('-password')
      .lean();

    res.json({ users: directoryUsers });

  } catch (error) {
    console.error('Get directory error:', error);
    res.status(500).json({ error: 'Failed to get user directory' });
  }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchTerm = query.toLowerCase();

    // Search across name and profile fields (they live in the profile subdocument)
    const searchQuery = {
      isActive: true,
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { 'profile.degree': { $regex: searchTerm, $options: 'i' } },
        { 'profile.company': { $regex: searchTerm, $options: 'i' } },
        { 'profile.department': { $regex: searchTerm, $options: 'i' } },
        { 'profile.location': { $regex: searchTerm, $options: 'i' } }
      ]
    };

    const filteredUsers = await User.find(searchQuery)
      .select('-password')
      .lean();

    res.json({ users: filteredUsers });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;