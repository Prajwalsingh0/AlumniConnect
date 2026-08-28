const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    location: {
        city: String,
        state: String,
        country: String
    },
    description: String,
    leads: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: String
    }],
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    events: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    }],
    socialLinks: {
        facebook: String,
        linkedin: String,
        twitter: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Chapter', chapterSchema);
