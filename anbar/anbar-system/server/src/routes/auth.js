const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });

  const user = db
    .prepare(
      `SELECT u.*, r.name AS role_name FROM users u
       JOIN roles r ON r.id = u.role_id WHERE u.username = ?`
    )
    .get(username);

  if (!user || !user.is_active) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });

  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '12h' });
  const perms = db
    .prepare(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`
    )
    .all(user.role_id)
    .map((r) => r.code);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role_name,
      permissions: perms,
    },
  });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
