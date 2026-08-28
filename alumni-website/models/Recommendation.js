const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    relationship: {
        type: String,
        enum: ['Colleague', 'Classmate', 'Mentor', 'Mentee', 'Project Member'],
        required: true
    },
    content: {
        type: String,
        required: [true, 'Recommendation content is required'],
        maxlength: [1000, 'Recommendation cannot exceed 1000 characters']
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Recommendation', recommendationSchema);
