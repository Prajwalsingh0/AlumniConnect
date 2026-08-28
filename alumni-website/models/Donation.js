const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    campaign: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'paypal', 'bank_transfer', 'other']
    },
    transactionId: String,
    isAnonymous: {
        type: Boolean,
        default: false
    },
    message: String,
    receiptUrl: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Donation', donationSchema);
