const mongoose = require('mongoose');

const mentorshipSchema = new mongoose.Schema({
    mentor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    mentee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'declined', 'cancelled'],
        default: 'pending'
    },
    areaOfInterest: {
        type: String,
        required: true
    },
    goals: [String],
    startDate: Date,
    endDate: Date,
    notes: String,
    sessions: [{
        date: Date,
        title: String,
        summary: String,
        feedback: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Mentorship', mentorshipSchema);
