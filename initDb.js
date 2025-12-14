const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Initialize database
const db = new sqlite3.Database('./database/tasks.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('team', 'admin', 'system_admin')),
        department TEXT,
        zone TEXT,
        is_active BOOLEAN DEFAULT 1,
        is_hardcoded BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create tasks table
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        zone TEXT NOT NULL,
        priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'in_progress', 'completed', 'rejected')),
        requested_by TEXT NOT NULL,
        requested_by_name TEXT NOT NULL,
        assigned_to TEXT,
        assigned_to_name TEXT,
        approved_by TEXT,
        approved_by_name TEXT,
        approved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        due_date DATE,
        completed_at DATETIME,
        remarks TEXT,
        FOREIGN KEY (requested_by) REFERENCES users(email),
        FOREIGN KEY (approved_by) REFERENCES users(email),
        FOREIGN KEY (assigned_to) REFERENCES users(email)
    )`);

    // Create activity log table
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        user_email TEXT,
        user_name TEXT,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
    )`);

    // Insert hardcoded users
    insertHardcodedUsers();
}

async function insertHardcodedUsers() {
    const teamMembers = [
        { email: 'subash@teamlead.com', name: 'Subash Rai', password: 'Subash@866', role: 'team', department: 'Landscaping', zone: 'Downtown' },
        { email: 'pawan@teamlead.com', name: 'Pawan Koirala', password: 'Pawan@592', role: 'team', department: 'Maintenance', zone: 'Areesh/Green Team/PODs Indoor' },
        { email: 'sujan@teamlead.com', name: 'Sujan Subedi', password: 'Sujan@576', role: 'team', department: 'Irrigation', zone: 'MUD IP' },
        { email: 'saroj@teamlead.com', name: 'Saroj Pokhrel', password: 'Saroj@511', role: 'team', department: 'VIP Services', zone: 'PODs/VIP/RC/gate 5' },
        { email: 'taraknath@teamlead.com', name: 'Taraknath Sharma', password: 'Tarak@593', role: 'team', department: 'Golf Course', zone: 'Golf Landscaping' },
        { email: 'ghadindra@teamlead.com', name: 'Ghadindra Chaulagain', password: 'Ghadin@570', role: 'team', department: 'Irrigation', zone: 'Irrigation MUD/IP/POD/GATE 5' },
        { email: 'shambhu@teamlead.com', name: 'Shambhu Kumar Sah', password: 'Shambhu@506', role: 'team', department: 'Irrigation', zone: 'Irrigation Areesh/Downtown' },
        { email: 'sunil@teamlead.com', name: 'Sunil Kumar Sah Sudi', password: 'Sunil@583', role: 'team', department: 'Irrigation', zone: 'Palm Trees' }
    ];

    const admins = [
        { email: 'admin@landscape.com', name: 'System Admin', password: 'Landscape@2025', role: 'admin' },
        { email: 'victor@landscape.com', name: 'Victor AM', password: 'Vic123', role: 'admin' },
        { email: 'james@landscape.com', name: 'James Manager', password: 'Manager2025', role: 'admin' },
        { email: 'mike@landscape.com', name: 'Mike AM', password: 'Michael123', role: 'admin' },
        { email: 'chhabi@landscape.com', name: 'Chhabi Admin', password: 'Admin@2025', role: 'system_admin' }
    ];

    // Hash passwords and insert users
    const allUsers = [...teamMembers, ...admins];
    
    for (const user of allUsers) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        db.run(
            `INSERT OR IGNORE INTO users (email, name, password, role, department, zone, is_hardcoded) 
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [user.email, user.name, hashedPassword, user.role, user.department || null, user.zone || null],
            (err) => {
                if (err) {
                    console.error('Error inserting user:', user.email, err.message);
                }
            }
        );
    }
    
    console.log('Database initialized with hardcoded users');
}

module.exports = db;