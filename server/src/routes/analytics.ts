import express from 'express';
import { getDb } from '../db';
import { authenticateToken } from '../auth';

const router = express.Router();

router.get('/summary', authenticateToken, (req, res) => {
  const db = getDb();

  const totalLeads = (db.prepare('SELECT COUNT(*) as count FROM leads').get() as any).count;
  const qualifiedLeads = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'qualified'").get() as any).count;
  const totalClients = (db.prepare('SELECT COUNT(*) as count FROM clients').get() as any).count;
  const totalRevenue = (db.prepare("SELECT COALESCE(SUM(value),0) as total FROM deals WHERE stage = 'closed_won'").get() as any).total;
  const openDeals = (db.prepare("SELECT COUNT(*) as count FROM deals WHERE stage NOT IN ('closed_won','closed_lost')").get() as any).count;
  const openDealsValue = (db.prepare("SELECT COALESCE(SUM(value),0) as total FROM deals WHERE stage NOT IN ('closed_won','closed_lost')").get() as any).total;
  const pendingTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status != 'completed'").get() as any).count;
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE date(due_date) = ? AND status != 'completed'").get(today) as any).count;

  const dealsByStage = db.prepare(`
    SELECT stage, COUNT(*) as count, COALESCE(SUM(value),0) as total
    FROM deals GROUP BY stage
  `).all();

  const leadsBySource = db.prepare(`
    SELECT source, COUNT(*) as count FROM leads WHERE source IS NOT NULL GROUP BY source
  `).all();

  const leadsByStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM leads GROUP BY status
  `).all();

  // Revenue by month (last 6 months)
  const revenueByMonth = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(value),0) as revenue
    FROM deals WHERE stage = 'closed_won' 
    AND created_at >= date('now', '-6 months')
    GROUP BY month ORDER BY month ASC
  `).all();

  const recentActivities = db.prepare(`
    SELECT a.*, u.name as user_name FROM activities a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT 10
  `).all();

  const taskCompletion = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      COUNT(*) as total
    FROM tasks
  `).get() as any;

  res.json({
    kpis: { totalLeads, qualifiedLeads, totalClients, totalRevenue, openDeals, openDealsValue, pendingTasks, todayTasks },
    dealsByStage,
    leadsBySource,
    leadsByStatus,
    revenueByMonth,
    recentActivities,
    taskCompletion
  });
});

export default router;
