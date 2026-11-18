const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key-before-production';

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'ورود لازم است' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db
      .prepare(
        `SELECT u.id, u.username, u.full_name, u.role_id, r.name AS role_name
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND u.is_active = 1`
      )
      .get(payload.sub);
    if (!user) return res.status(401).json({ error: 'کاربر یافت نشد یا غیرفعال است' });
    const perms = db
      .prepare(
        `SELECT p.code FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ?`
      )
      .all(user.role_id)
      .map((r) => r.code);
    req.user = { ...user, permissions: perms };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'توکن نامعتبر یا منقضی شده است' });
  }
}

function requirePermission(code) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(code)) {
      return res.status(403).json({ error: 'دسترسی کافی ندارید' });
    }
    next();
  };
}

module.exports = { authenticate, requirePermission, JWT_SECRET };
