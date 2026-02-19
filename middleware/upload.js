const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    // Normalize extension
    const normalizedExt = ext === '.jpeg' ? '.jpg' : ext;
    cb(null, file.fieldname + '-' + uniqueSuffix + normalizedExt);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  
  // Check mime type
  const mimeOk = allowedTypes.test(file.mimetype);
  
  // Check extension
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  if (mimeOk && extname) {
    return cb(null, true);
  }
  
  cb(new Error('Only image files are allowed!'));
};

// Create upload middleware with compression via multer limits
// Images are stored and served - browser-side compression handles quality
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 10 // 10MB max file size (before compression)
  }
});

// Post-processing: compress image after upload using jimp if available
// Otherwise, just limit the file size via multer
const compressImage = async (filePath) => {
  try {
    // Try to use jimp for compression if available
    const Jimp = require('jimp');
    const image = await Jimp.read(filePath);
    
    // Resize if too large (max 800px width/height maintaining aspect ratio)
    if (image.bitmap.width > 800 || image.bitmap.height > 800) {
      image.scaleToFit(800, 800);
    }
    
    // Set quality to 80% and save
    await image.quality(80).writeAsync(filePath);
    console.log(`✅ Image compressed: ${filePath}`);
  } catch (e) {
    // jimp not available, skip compression
    // The image will be stored as-is
    console.log(`ℹ️ Image compression skipped (jimp not available): ${path.basename(filePath)}`);
  }
};

// Middleware wrapper that compresses after upload
const uploadWithCompression = {
  single: (fieldName) => {
    return [
      upload.single(fieldName),
      async (req, res, next) => {
        if (req.file) {
          await compressImage(req.file.path);
        }
        next();
      }
    ];
  },
  array: (fieldName, maxCount) => {
    return [
      upload.array(fieldName, maxCount),
      async (req, res, next) => {
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            await compressImage(file.path);
          }
        }
        next();
      }
    ];
  }
};

// Also export the raw multer instance for backward compatibility
upload.withCompression = uploadWithCompression;

module.exports = upload;
