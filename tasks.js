const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const xlsx = require('xlsx');
const db = require('../database/initDb');

// Middleware to check authentication
const authenticate = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Get all tasks
router.get('/', authenticate, (req, res) => {
    const user = req.session.user;
    
    if (user.role === 'team') {
        // Team members see their own tasks
        Task.findByUser(user.email, (err, tasks) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(tasks);
            }
        });
    } else {
        // Admins see all tasks
        Task.findAll((err, tasks) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(tasks);
            }
        });
    }
});

// Create new task
router.post('/', authenticate, (req, res) => {
    const { title, description, zone, priority, due_date } = req.body;
    const user = req.session.user;

    if (!title || !description || !zone) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const taskData = {
        title,
        description,
        zone,
        priority: priority || 'normal',
        requested_by: user.email,
        requested_by_name: user.name,
        due_date: due_date || null
    };

    Task.create(taskData, (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            // Log activity
            const logSql = `INSERT INTO activity_logs (task_id, user_email, user_name, action, details) 
                           VALUES (?, ?, ?, ?, ?)`;
            db.run(logSql, [result.id, user.email, user.name, 'created', `Task "${title}" created`], () => {});
            
            res.json({ success: true, taskId: result.id });
        }
    });
});

// Update task
router.put('/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const user = req.session.user;

    // Check permissions
    Task.findById(id, (err, task) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Only system_admin can delete, others can only update status
        if (updates.status === 'deleted' && user.role !== 'system_admin') {
            return res.status(403).json({ error: 'Only system admin can delete tasks' });
        }

        Task.update(id, updates, (err, changes) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (changes === 0) {
                res.status(404).json({ error: 'Task not found' });
            } else {
                // Log activity
                const logSql = `INSERT INTO activity_logs (task_id, user_email, user_name, action, details) 
                               VALUES (?, ?, ?, ?, ?)`;
                db.run(logSql, [id, user.email, user.name, 'updated', JSON.stringify(updates)], () => {});
                
                res.json({ success: true });
            }
        });
    });
});

// Approve task
router.post('/:id/approve', authenticate, (req, res) => {
    const { id } = req.params;
    const user = req.session.user;

    if (user.role === 'team') {
        return res.status(403).json({ error: 'Only admins can approve tasks' });
    }

    Task.approve(id, user.email, user.name, (err, changes) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (changes === 0) {
            res.status(404).json({ error: 'Task not found' });
        } else {
            // Log activity
            const logSql = `INSERT INTO activity_logs (task_id, user_email, user_name, action) 
                           VALUES (?, ?, ?, ?)`;
            db.run(logSql, [id, user.email, user.name, 'approved'], () => {});
            
            res.json({ success: true });
        }
    });
});

// Assign task
router.post('/:id/assign', authenticate, (req, res) => {
    const { id } = req.params;
    const { assigneeEmail, assigneeName } = req.body;
    const user = req.session.user;

    if (user.role === 'team') {
        return res.status(403).json({ error: 'Only admins can assign tasks' });
    }

    Task.assign(id, assigneeEmail, assigneeName, (err, changes) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (changes === 0) {
            res.status(404).json({ error: 'Task not found' });
        } else {
            // Log activity
            const logSql = `INSERT INTO activity_logs (task_id, user_email, user_name, action, details) 
                           VALUES (?, ?, ?, ?, ?)`;
            db.run(logSql, [id, user.email, user.name, 'assigned', `Assigned to ${assigneeName}`], () => {});
            
            res.json({ success: true });
        }
    });
});

// Complete task
router.post('/:id/complete', authenticate, (req, res) => {
    const { id } = req.params;
    const { remarks } = req.body;
    const user = req.session.user;

    Task.complete(id, remarks, (err, changes) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (changes === 0) {
            res.status(404).json({ error: 'Task not found' });
        } else {
            // Log activity
            const logSql = `INSERT INTO activity_logs (task_id, user_email, user_name, action, details) 
                           VALUES (?, ?, ?, ?, ?)`;
            db.run(logSql, [id, user.email, user.name, 'completed', remarks], () => {});
            
            res.json({ success: true });
        }
    });
});

// Delete task (system admin only)
router.delete('/:id', authenticate, (req, res) => {
    const { id } = req.params;
    const user = req.session.user;

    if (user.role !== 'system_admin') {
        return res.status(403).json({ error: 'Only system admin can delete tasks' });
    }

    Task.delete(id, (err, changes) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (changes === 0) {
            res.status(404).json({ error: 'Task not found' });
        } else {
            // Log activity
            const logSql = `INSERT INTO activity_logs (user_email, user_name, action, details) 
                           VALUES (?, ?, ?, ?)`;
            db.run(logSql, [user.email, user.name, 'deleted', `Task ${id} deleted`], () => {});
            
            res.json({ success: true });
        }
    });
});

// Export tasks to Excel
router.get('/export/excel', authenticate, (req, res) => {
    Task.findAll((err, tasks) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Format data for Excel
        const formattedData = tasks.map(task => ({
            'ID': task.id,
            'Title': task.title,
            'Description': task.description,
            'Zone': task.zone,
            'Priority': task.priority,
            'Status': task.status,
            'Requested By': task.requested_by_name,
            'Assigned To': task.assigned_to_name || 'Not Assigned',
            'Approved By': task.approved_by_name || 'Not Approved',
            'Approved At': task.approved_at,
            'Created At': task.created_at,
            'Due Date': task.due_date,
            'Completed At': task.completed_at,
            'Remarks': task.remarks || ''
        }));

        // Create workbook
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(formattedData);
        xlsx.utils.book_append_sheet(wb, ws, 'Tasks');

        // Generate buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=tasks_export.xlsx');
        res.send(buffer);
    });
});

// Get statistics
router.get('/stats', authenticate, (req, res) => {
    Task.getStats((err, stats) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(stats);
        }
    });
});

// Get users for assignment
router.get('/users', authenticate, (req, res) => {
    const { role } = req.query;
    let sql = 'SELECT email, name, role, department FROM users WHERE is_active = 1';
    const params = [];

    if (role) {
        sql += ' AND role = ?';
        params.push(role);
    }

    db.all(sql, params, (err, users) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(users);
        }
    });
});

// Get activity logs
router.get('/:id/logs', authenticate, (req, res) => {
    const { id } = req.params;
    
    db.all('SELECT * FROM activity_logs WHERE task_id = ? ORDER BY timestamp DESC', [id], (err, logs) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(logs);
        }
    });
});

module.exports = router;