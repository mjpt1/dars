const express = require('express');
const path = require('path');
const { authenticate, requirePermission } = require('../middleware/auth');
const { runBackup, listBackups, BACKUP_DIR } = require('../services/backup');

const router = express.Router();
router.use(authenticate);
router.use(requirePermission('backup.manage'));

router.get('/', (req, res) => {
  res.json({ backups: listBackups(), backup_dir: BACKUP_DIR });
});

router.post('/run', (req, res) => {
  try {
    const dest = runBackup();
    res.status(201).json({ ok: true, file: path.basename(dest) });
  } catch (e) {
    res.status(500).json({ error: 'خطا در تهیه پشتیبان: ' + e.message });
  }
});

router.get('/download/:filename', (req, res) => {
  const filePath = path.join(BACKUP_DIR, req.params.filename);
  if (!filePath.startsWith(BACKUP_DIR)) return res.status(400).json({ error: 'مسیر نامعتبر' });
  res.download(filePath);
});

module.exports = router;
