const db = require('../database/initDb');

class Task {
    static create(taskData, callback) {
        const sql = `INSERT INTO tasks 
            (title, description, zone, priority, requested_by, requested_by_name, due_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [
            taskData.title,
            taskData.description,
            taskData.zone,
            taskData.priority || 'normal',
            taskData.requested_by,
            taskData.requested_by_name,
            taskData.due_date
        ], function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null, { id: this.lastID });
            }
        });
    }

    static update(id, updates, callback) {
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updates)) {
            if (key !== 'id') {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
        
        db.run(sql, values, function(err) {
            callback(err, this.changes);
        });
    }

    static findAll(callback) {
        db.all(`SELECT * FROM tasks ORDER BY 
            CASE priority 
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'normal' THEN 3
                WHEN 'low' THEN 4
            END, created_at DESC`, callback);
    }

    static findById(id, callback) {
        db.get('SELECT * FROM tasks WHERE id = ?', [id], callback);
    }

    static findByUser(email, callback) {
        db.all('SELECT * FROM tasks WHERE requested_by = ? OR assigned_to = ? ORDER BY created_at DESC', 
            [email, email], callback);
    }

    static delete(id, callback) {
        db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
            callback(err, this.changes);
        });
    }

    static approve(id, approverEmail, approverName, callback) {
        const sql = `UPDATE tasks SET 
            status = 'approved',
            approved_by = ?,
            approved_by_name = ?,
            approved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`;
        
        db.run(sql, [approverEmail, approverName, id], function(err) {
            callback(err, this.changes);
        });
    }

    static assign(id, assigneeEmail, assigneeName, callback) {
        const sql = `UPDATE tasks SET 
            assigned_to = ?,
            assigned_to_name = ?,
            status = 'in_progress',
            updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`;
        
        db.run(sql, [assigneeEmail, assigneeName, id], function(err) {
            callback(err, this.changes);
        });
    }

    static complete(id, remarks, callback) {
        const sql = `UPDATE tasks SET 
            status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            remarks = ?,
            updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`;
        
        db.run(sql, [remarks, id], function(err) {
            callback(err, this.changes);
        });
    }

    static getStats(callback) {
        const sql = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent
            FROM tasks
        `;
        db.get(sql, callback);
    }
}

module.exports = Task;