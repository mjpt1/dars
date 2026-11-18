require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const inventoryRoutes = require('./routes/inventory');
const projectRoutes = require('./routes/projects');
const financeRoutes = require('./routes/finance');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const accountingRoutes = require('./routes/accounting');
const notificationRoutes = require('./routes/notifications');
const backupRoutes = require('./routes/backup');
const { startScheduler } = require('./services/backup');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'anbar-server' }));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/backup', backupRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'خطای داخلی سرور' });
});

const PORT = process.env.PORT || 4500;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`سرور انبار روی پورت ${PORT} اجرا شد.`);
  console.log(`آدرس دسترسی از شبکه محلی: http://<IP-این-سیستم>:${PORT}/api/health`);
  startScheduler();
});
