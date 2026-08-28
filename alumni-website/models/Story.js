const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    excerpt: {
        type: String,
        required: true,
        maxlength: 200
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Career', 'Academic', 'Entrepreneurship', 'Personal Growth', 'Technology', 'Other']
    },
    tags: [{
        type: String
    }],
    image: {
        type: String,
        default: ''
    },
    isPublished: {
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
    likes: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        likedAt: {
            type: Date,
            default: Date.now
        }
    }],
    comments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    readTime: {
        type: Number,
        default: 5
    }
}, {
    timestamps: true
});

// Virtual for like count
storySchema.virtual('likeCount').get(function() {
    return this.likes.length;
});

// Virtual for comment count
storySchema.virtual('commentCount').get(function() {
    return this.comments.length;
});

// Method to add like
storySchema.methods.addLike = async function(userId) {
    const existingLike = this.likes.find(
        like => like.user.toString() === userId.toString()
    );
    
    if (existingLike) {
        this.likes = this.likes.filter(
            like => like.user.toString() !== userId.toString()
        );
    } else {
        this.likes.push({ user: userId });
    }
    
    await this.save();
};

// Method to add comment
storySchema.methods.addComment = async function(userId, content) {
    this.comments.push({
        user: userId,
        content: content
    });
    await this.save();
};

// Method to increment views
storySchema.methods.incrementViews = async function() {
    this.views += 1;
    await this.save();
};

// Calculate read time based on content length
storySchema.pre('save', function(next) {
    if (this.isModified('content')) {
        const wordsPerMinute = 200;
        const wordCount = this.content.split(/\s+/).length;
        this.readTime = Math.ceil(wordCount / wordsPerMinute) || 1;
    }
    next();
});

// Index for efficient queries
storySchema.index({ isPublished: 1, createdAt: -1 });
storySchema.index({ category: 1, isPublished: 1 });
storySchema.index({ author: 1 });
storySchema.index({ isFeatured: 1, isPublished: 1 });

module.exports = mongoose.model('Story', storySchema);