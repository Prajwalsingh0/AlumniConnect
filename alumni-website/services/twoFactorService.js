const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Generate 2FA secret
const generate2FASecret = (email) => {
    const secret = speakeasy.generateSecret({
        name: `Alumni Network (${email})`,
        length: 32
    });

    return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url
    };
};

// Generate QR code
const generateQRCode = async (otpauthUrl) => {
    try {
        const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
        return qrCodeUrl;
    } catch (error) {
        throw new Error('Failed to generate QR code');
    }
};

// Verify 2FA token
const verify2FAToken = (secret, token) => {
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps
    });
};

module.exports = {
    generate2FASecret,
    generateQRCode,
    verify2FAToken
};
