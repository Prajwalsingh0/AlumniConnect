const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    goalAmount: {
        type: Number,
        required: true
    },
    currentAmount: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        required: true
    },
    category: {
        type: String,
        enum: ['scholarship', 'infrastructure', 'research', 'event', 'emergency', 'other'],
        default: 'other'
    },
    image: String,
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled', 'draft'],
        default: 'active'
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Campaign', campaignSchema);
