const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Load alumni data
let alumniData = require('../data/alumni.json');

// Validation middleware
const validateAlumniProfile = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('graduationYear').isInt({ min: 1900, max: new Date().getFullYear() }).withMessage('Please provide a valid graduation year'),
  body('degree').trim().isLength({ min: 2 }).withMessage('Degree is required'),
  body('position').trim().isLength({ min: 2 }).withMessage('Position is required'),
  body('company').trim().isLength({ min: 2 }).withMessage('Company is required'),
  body('location').trim().isLength({ min: 2 }).withMessage('Location is required'),
  body('linkedin').optional().isURL().withMessage('Please provide a valid LinkedIn URL'),
  body('email').optional().isEmail().withMessage('Please provide a valid email address')
];

// Get all alumni
router.get('/', (req, res) => {
  try {
    const { featured, search, year, degree, location, industry } = req.query;
    let filteredAlumni = [...alumniData];

    // Filter featured alumni
    if (featured === 'true') {
      filteredAlumni = filteredAlumni.filter(alumni => alumni.featured === true);
    }

    // Filter by graduation year
    if (year) {
      filteredAlumni = filteredAlumni.filter(alumni => alumni.graduationYear === parseInt(year));
    }

    // Filter by degree
    if (degree) {
      filteredAlumni = filteredAlumni.filter(alumni => 
        alumni.degree.toLowerCase().includes(degree.toLowerCase())
      );
    }

    // Filter by location
    if (location) {
      filteredAlumni = filteredAlumni.filter(alumni => 
        alumni.location.toLowerCase().includes(location.toLowerCase())
      );
    }

    // Filter by industry
    if (industry) {
      filteredAlumni = filteredAlumni.filter(alumni => 
        alumni.industry && alumni.industry.toLowerCase().includes(industry.toLowerCase())
      );
    }

    // Search by name, company, or position
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredAlumni = filteredAlumni.filter(alumni => 
        alumni.name.toLowerCase().includes(searchTerm) ||
        alumni.company.toLowerCase().includes(searchTerm) ||
        alumni.position.toLowerCase().includes(searchTerm) ||
        alumni.degree.toLowerCase().includes(searchTerm)
      );
    }

    // Sort by graduation year (newest first)
    filteredAlumni.sort((a, b) => b.graduationYear - a.graduationYear);

    res.json({ alumni: filteredAlumni });
  } catch (error) {
    console.error('Get alumni error:', error);
    res.status(500).json({ error: 'Failed to get alumni' });
  }
});

// Get single alumni by ID
router.get('/:id', (req, res) => {
  try {
    const alumni = alumniData.find(a => a.id === req.params.id);
    
    if (!alumni) {
      return res.status(404).json({ error: 'Alumni not found' });
    }

    res.json({ alumni });
  } catch (error) {
    console.error('Get alumni error:', error);
    res.status(500).json({ error: 'Failed to get alumni' });
  }
});

// Get featured alumni
router.get('/featured/list', (req, res) => {
  try {
    const featuredAlumni = alumniData
      .filter(alumni => alumni.featured === true)
      .sort((a, b) => b.graduationYear - a.graduationYear);

    res.json({ alumni: featuredAlumni });
  } catch (error) {
    console.error('Get featured alumni error:', error);
    res.status(500).json({ error: 'Failed to get featured alumni' });
  }
});

// Get alumni stories
router.get('/stories/list', (req, res) => {
  try {
    const alumniWithStories = alumniData
      .filter(alumni => alumni.story && alumni.story.trim().length > 0)
      .sort((a, b) => b.graduationYear - a.graduationYear);

    res.json({ alumni: alumniWithStories });
  } catch (error) {
    console.error('Get alumni stories error:', error);
    res.status(500).json({ error: 'Failed to get alumni stories' });
  }
});

// Get alumni by graduation year
router.get('/year/:year', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const alumniByYear = alumniData
      .filter(alumni => alumni.graduationYear === year)
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ alumni: alumniByYear });
  } catch (error) {
    console.error('Get alumni by year error:', error);
    res.status(500).json({ error: 'Failed to get alumni by year' });
  }
});

// Get statistics
router.get('/stats/overview', (req, res) => {
  try {
    const totalAlumni = alumniData.length;
    const featuredCount = alumniData.filter(a => a.featured === true).length;
    const withStoriesCount = alumniData.filter(a => a.story && a.story.trim().length > 0).length;
    
    // Get graduation years range
    const graduationYears = alumniData.map(a => a.graduationYear);
    const oldestYear = Math.min(...graduationYears);
    const newestYear = Math.max(...graduationYears);

    // Get degree distribution
    const degreeDistribution = {};
    alumniData.forEach(alumni => {
      degreeDistribution[alumni.degree] = (degreeDistribution[alumni.degree] || 0) + 1;
    });

    // Get location distribution
    const locationDistribution = {};
    alumniData.forEach(alumni => {
      locationDistribution[alumni.location] = (locationDistribution[alumni.location] || 0) + 1;
    });

    res.json({
      totalAlumni,
      featuredCount,
      withStoriesCount,
      oldestYear,
      newestYear,
      degreeDistribution,
      locationDistribution
    });
  } catch (error) {
    console.error('Get alumni stats error:', error);
    res.status(500).json({ error: 'Failed to get alumni statistics' });
  }
});

// Create alumni profile (admin only)
router.post('/', authenticateToken, validateAlumniProfile, (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const newAlumni = {
      id: uuidv4(),
      ...req.body,
      featured: req.body.featured || false,
      achievements: req.body.achievements || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    alumniData.push(newAlumni);

    res.status(201).json({
      message: 'Alumni profile created successfully',
      alumni: newAlumni
    });

  } catch (error) {
    console.error('Create alumni error:', error);
    res.status(500).json({ error: 'Failed to create alumni profile' });
  }
});

// Update alumni profile (admin only)
router.put('/:id', authenticateToken, validateAlumniProfile, (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const alumniIndex = alumniData.findIndex(a => a.id === req.params.id);
    
    if (alumniIndex === -1) {
      return res.status(404).json({ error: 'Alumni not found' });
    }

    alumniData[alumniIndex] = {
      ...alumniData[alumniIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    res.json({
      message: 'Alumni profile updated successfully',
      alumni: alumniData[alumniIndex]
    });

  } catch (error) {
    console.error('Update alumni error:', error);
    res.status(500).json({ error: 'Failed to update alumni profile' });
  }
});

// Delete alumni profile (admin only)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const alumniIndex = alumniData.findIndex(a => a.id === req.params.id);
    
    if (alumniIndex === -1) {
      return res.status(404).json({ error: 'Alumni not found' });
    }

    alumniData.splice(alumniIndex, 1);

    res.json({ message: 'Alumni profile deleted successfully' });

  } catch (error) {
    console.error('Delete alumni error:', error);
    res.status(500).json({ error: 'Failed to delete alumni profile' });
  }
});

// Get similar alumni (based on degree, location, or industry)
router.get('/:id/similar', (req, res) => {
  try {
    const alumni = alumniData.find(a => a.id === req.params.id);
    
    if (!alumni) {
      return res.status(404).json({ error: 'Alumni not found' });
    }

    const similarAlumni = alumniData
      .filter(a => 
        a.id !== req.params.id && (
          a.degree === alumni.degree ||
          a.location === alumni.location ||
          a.industry === alumni.industry
        )
      )
      .slice(0, 6); // Limit to 6 similar alumni

    res.json({ alumni: similarAlumni });
  } catch (error) {
    console.error('Get similar alumni error:', error);
    res.status(500).json({ error: 'Failed to get similar alumni' });
  }
});

module.exports = router;