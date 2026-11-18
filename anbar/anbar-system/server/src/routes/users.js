const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('users.manage'), (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT u.id, u.username, u.full_name, u.is_active, u.last_login_at, r.name AS role_name, r.id AS role_id
         FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id`
      )
      .all()
  );
});

router.get('/roles', requirePermission('users.manage'), (req, res) => {
  res.json(db.prepare('SELECT * FROM roles ORDER BY id').all());
});

router.post('/', requirePermission('users.manage'), (req, res) => {
  const { username, password, full_name, role_id } = req.body;
  if (!username || !password || !full_name || !role_id) {
    return res.status(400).json({ error: 'همه فیلدها الزامی است' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare('INSERT INTO users (username, password_hash, full_name, role_id) VALUES (?, ?, ?, ?)')
      .run(username, hash, full_name, role_id);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'نام کاربری تکراری است' });
  }
});

router.put('/:id', requirePermission('users.manage'), (req, res) => {
  const { full_name, role_id, is_active, password } = req.body;
  db.prepare('UPDATE users SET full_name=?, role_id=?, is_active=? WHERE id=?').run(
    full_name,
    role_id,
    is_active === undefined ? 1 : is_active,
    req.params.id
  );
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.params.id);
  }
  res.json({ ok: true });
});

module.exports = router;
