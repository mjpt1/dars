const express = require('express');
const db = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requirePermission('project.view'), (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT p.*, u.full_name AS manager_name, c.name AS customer_name,
                (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id) AS task_count,
                (SELECT COUNT(*) FROM project_tasks t WHERE t.project_id = p.id AND t.status='done') AS done_count,
                (SELECT COALESCE(SUM(amount),0) FROM project_costs pc WHERE pc.project_id = p.id) AS spent
         FROM projects p
         LEFT JOIN users u ON u.id = p.manager_id
         LEFT JOIN customers c ON c.id = p.customer_id
         ORDER BY p.id DESC`
      )
      .all()
  );
});

router.post('/', requirePermission('project.manage'), (req, res) => {
  const { code, name, customer_id, manager_id, start_date, end_date, budget, description } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'کد و نام پروژه الزامی است' });
  try {
    const info = db
      .prepare(
        `INSERT INTO projects (code, name, customer_id, manager_id, start_date, end_date, budget, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(code, name, customer_id || null, manager_id || null, start_date || null, end_date || null, budget || 0, description || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'کد پروژه تکراری است' });
  }
});

router.put('/:id', requirePermission('project.manage'), (req, res) => {
  const { name, status, manager_id, start_date, end_date, budget, description } = req.body;
  db.prepare(
    `UPDATE projects SET name=?, status=?, manager_id=?, start_date=?, end_date=?, budget=?, description=? WHERE id=?`
  ).run(name, status, manager_id || null, start_date || null, end_date || null, budget || 0, description || null, req.params.id);
  res.json({ ok: true });
});

router.get('/:id', requirePermission('project.view'), (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'پروژه یافت نشد' });
  const tasks = db
    .prepare(
      `SELECT t.*, u.full_name AS assignee_name FROM project_tasks t
       LEFT JOIN users u ON u.id = t.assigned_to WHERE t.project_id = ? ORDER BY t.id`
    )
    .all(req.params.id);
  const costs = db.prepare('SELECT * FROM project_costs WHERE project_id = ? ORDER BY cost_date DESC').all(req.params.id);
  res.json({ ...project, tasks, costs });
});

// ---------- وظایف پروژه ----------
router.post('/:id/tasks', requirePermission('project.manage'), (req, res) => {
  const { title, parent_task_id, depends_on_task_id, priority, start_date, due_date, assigned_to, estimated_hours } = req.body;
  if (!title) return res.status(400).json({ error: 'عنوان وظیفه الزامی است' });
  const info = db
    .prepare(
      `INSERT INTO project_tasks (project_id, parent_task_id, depends_on_task_id, title, priority, start_date, due_date, assigned_to, estimated_hours)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.params.id,
      parent_task_id || null,
      depends_on_task_id || null,
      title,
      priority || 'normal',
      start_date || null,
      due_date || null,
      assigned_to || null,
      estimated_hours || null
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/tasks/:taskId', requirePermission('project.manage'), (req, res) => {
  const { title, status, priority, progress, start_date, due_date, assigned_to, depends_on_task_id } = req.body;
  db.prepare(
    `UPDATE project_tasks SET title=?, status=?, priority=?, progress=?, start_date=?, due_date=?, assigned_to=?, depends_on_task_id=? WHERE id=?`
  ).run(
    title,
    status,
    priority,
    progress || 0,
    start_date || null,
    due_date || null,
    assigned_to || null,
    depends_on_task_id || null,
    req.params.taskId
  );
  res.json({ ok: true });
});

// ---------- هزینه‌های پروژه ----------
router.post('/:id/costs', requirePermission('project.manage'), (req, res) => {
  const { cost_type, title, amount, notes } = req.body;
  if (!cost_type || !title || !amount) return res.status(400).json({ error: 'نوع، عنوان و مبلغ هزینه الزامی است' });
  const info = db
    .prepare(`INSERT INTO project_costs (project_id, cost_type, title, amount, notes) VALUES (?, ?, ?, ?, ?)`)
    .run(req.params.id, cost_type, title, amount, notes || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
