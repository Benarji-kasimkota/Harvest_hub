const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ALLOWED_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    // Strip original name entirely — use only random token + whitelisted extension
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIMETYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', protect, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.json({ url: `${baseUrl}/uploads/${req.file.filename}` });
});

module.exports = router;
