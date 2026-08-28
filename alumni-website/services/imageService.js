const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const processImage = async (inputPath, options = {}) => {
    const {
        width = 800,
        height = 800,
        quality = 80,
        format = 'webp'
    } = options;

    const outputPath = inputPath.replace(path.extname(inputPath), `.${format}`);

    await sharp(inputPath)
        .resize(width, height, {
            fit: 'cover',
            position: 'center'
        })
        .toFormat(format, { quality })
        .toFile(outputPath);

    // Delete original if it's different from output
    if (inputPath !== outputPath) {
        await fs.unlink(inputPath).catch(err => console.error('Failed to delete temp file:', err));
    }

    return outputPath;
};

// Generate thumbnail
const generateThumbnail = async (inputPath, size = 150) => {
    const ext = path.extname(inputPath);
    const thumbnailPath = inputPath.replace(ext, `-thumb${ext}`);

    await sharp(inputPath)
        .resize(size, size, { fit: 'cover' })
        .toFile(thumbnailPath);

    return thumbnailPath;
};

module.exports = {
    processImage,
    generateThumbnail
};
