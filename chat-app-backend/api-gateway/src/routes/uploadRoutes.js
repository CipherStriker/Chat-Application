const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { protect } = require('../middleware/authMiddleware');
const { minioClient, BUCKET_NAME } = require('../config/minio');

const router = express.Router();
const upload = multer({ memoryStorage: multer.memoryStorage() });

router.post('/', protect, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const ext = path.extname(req.file.originalname);
    const uniqueFilename = `${uuidv4()}${ext}`;

    await minioClient.putObject(
      BUCKET_NAME,
      uniqueFilename,
      req.file.buffer,
      req.file.size,
      { 'Content-Type': req.file.mimetype }
    );

    const fileUrl = `/chat-files/${uniqueFilename}`;

    return res.status(201).json({
      fileUrl,
      fileType: req.file.mimetype,
    });
  } catch (err) {
    console.error('File upload error:', err.message);
    return res.status(500).json({ error: 'File upload failed' });
  }
});

module.exports = router;
