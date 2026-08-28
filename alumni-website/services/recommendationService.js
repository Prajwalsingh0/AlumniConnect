const User = require('../models/User');
const Job = require('../models/Job');
const Chapter = require('../models/Chapter');

/**
 * Get recommended jobs for a user based on skills and industry
 */
const getRecommendedJobs = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return [];

    const userSkills = user.profile.skills || [];
    const userIndustry = user.profile.industry || '';

    return await Job.find({
        $or: [
            { skills: { $in: userSkills } },
            { 'company.industry': userIndustry }
        ],
        status: 'published'
    }).limit(5);
};

/**
 * Get recommended mentors based on department and degree
 */
const getRecommendedMentors = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return [];

    return await User.find({
        role: 'alumni',
        _id: { $ne: userId },
        'profile.department': user.profile.department,
        'profile.graduationYear': { $lt: user.profile.graduationYear }
    }).limit(5);
};

module.exports = {
    getRecommendedJobs,
    getRecommendedMentors
};
