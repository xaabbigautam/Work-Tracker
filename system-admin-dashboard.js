let currentUser = null;
let allTasks = [];
let allUsers = [];
let allLogs = [];
let deleteType = '';
let deleteId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadUserInfo();
    loadSystemDashboard();
});

async function checkAuth() {
    try {
        const response = await fetch('/api/session');
        const data = await response.json();
        
        if (!data.loggedIn || data.user.role !== 'system_admin') {
            window.location.href = '/login';
            return;
        }
        
        currentUser = data.user;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
    }
}

function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Show corresponding view
            const viewId = link.getAttribute('data-view');
            showView(viewId);
        });
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function loadUserInfo() {
    if (!currentUser) return;
    
    const userInfoDiv = document.getElementById('userInfo');
    userInfoDiv.innerHTML = `
        <div class="user-avatar">${currentUser.name.charAt(0)}</div>
        <div class="user-details">
            <h3>${currentUser.name}</h3>
            <p>System Administrator</p>
        </div>
        <button class="logout-btn" id="logoutBtn">
            <i class="fas fa-sign-out-alt"></i> Logout
        </button>
    `;
    
    // Re-attach logout listener
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

async function loadSystemDashboard() {
    try {
        // Load tasks
        const tasksResponse = await fetch('/api/tasks', {
            credentials: 'include'
        });
        
        if (tasksResponse.ok) {
            allTasks = await tasksResponse.json();
            updateSystemStats();
        }
        
        // Load users
        await loadAllUsers();
        
        // Load logs
        await loadSystemLogs();
        
    } catch (error) {
        console.error('Error loading system data:', error);
        showAlert('Failed to load system data', 'error');
    }
}

function updateSystemStats() {
    document.getElementById('totalTasks').textContent = allTasks.length;
    document.getElementById('urgentTasks').textContent = allTasks.filter(t => t.priority === 'urgent').length;
    document.getElementById('totalUsers').textContent = allUsers.length;
    document.getElementById('totalLogs').textContent = allLogs.length;
}

async function loadAllUsers() {
    try {
        const response = await fetch('/api/tasks/users', {
            credentials: 'include'
        });
        
        if (response.ok) {
            allUsers = await response.json();
            renderUsersManagement();
            populateUserFilter();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadSystemLogs() {
    try {
        // Note: In production, you'd want a separate endpoint for all logs
        // For now, we'll simulate by getting logs for each task
        allLogs = [];
        
        // Load logs for each task
        for (const task of allTasks.slice(0, 50)) { // Limit to 50 tasks for performance
            const logsResponse = await fetch(`/api/tasks/${task.id}/logs`, {
                credentials: 'include'
            });
            
            if (logsResponse.ok) {
                const logs = await logsResponse.json();
                allLogs = allLogs.concat(logs);
            }
        }
        
        renderSystemLogs();
    } catch (error) {
        console.error('Error loading system logs:', error);
    }
}

function renderUsersManagement() {
    const usersList = document.getElementById('usersManagementList');
    if (!usersList) return;
    
    usersList.innerHTML = allUsers.map(user => `
        <div class="user-management-card">
            <div class="user-card-header">
                <div class="user-avatar-lg">${user.name.charAt(0)}</div>
                <div>
                    <h3>${user.name}</h3>
                    <p>${user.email}</p>
                    <span class="user-role-badge role-${user.role}">
                        ${user.role === 'system_admin' ? 'System Admin' : 
                          user.role === 'admin' ? 'Administrator' : 'Team Member'}
                    </span>
                </div>
            </div>
            
            <div class="user-card-body">
                <p><strong>Department:</strong> ${user.department || 'Not specified'}</p>
                <p><strong>Zone:</strong> ${user.zone || 'All zones'}</p>
                <p><strong>Status:</strong> ${user.is_active ? 'Active' : 'Inactive'}</p>
            </div>
            
            <div class="user-actions">
                <button class="btn btn-sm btn-primary" onclick="editUser('${user.email}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-secondary" onclick="toggleUserStatus('${user.email}', ${user.is_active})">
                    <i class="fas fa-power-off"></i> ${user.is_active ? 'Deactivate' : 'Activate'}
                </button>
                ${!user.is_hardcoded ? `
                <button class="btn btn-sm btn-danger" onclick="showDeleteUserModal('${user.email}', '${user.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
                ` : ''}
            </div>
            
            <div class="edit-user-form" id="edit-form-${user.email}">
                <h4>Edit User</h4>
                <form onsubmit="updateUser('${user.email}', event)">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" class="form-control" value="${user.name}" id="edit-name-${user.email}" required>
                    </div>
                    <div class="form-group">
                        <label>Department</label>
                        <input type="text" class="form-control" value="${user.department || ''}" id="edit-dept-${user.email}">
                    </div>
                    <div class="form-group">
                        <label>Zone</label>
                        <select class="zone-select" id="edit-zone-${user.email}">
                            <option value="">Select Zone</option>
                            <!-- Zones would be populated here -->
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select class="form-control" id="edit-role-${user.email}">
                            <option value="team" ${user.role === 'team' ? 'selected' : ''}>Team Member</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
                            <option value="system_admin" ${user.role === 'system_admin' ? 'selected' : ''}>System Admin</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>New Password (leave blank to keep current)</label>
                        <input type="password" class="form-control" id="edit-password-${user.email}">
                    </div>
                    <button type="submit" class="btn btn-primary">Update User</button>
                    <button type="button" class="btn" onclick="cancelEdit('${user.email}')">Cancel</button>
                </form>
            </div>
        </div>
    `).join('');
}

function renderSystemLogs() {
    const tableBody = document.getElementById('systemLogsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = allLogs.slice(0, 100).map(log => `
        <tr>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td>${log.user_name || 'System'}</td>
            <td><span class="status-badge">${log.action}</span></td>
            <td>${log.details || '-'}</td>
            <td>${log.task_id || '-'}</td>
        </tr>
    `).join('');
}

function populateUserFilter() {
    const userFilter = document.getElementById('logUserFilter');
    if (!userFilter) return;
    
    userFilter.innerHTML = '<option value="">All Users</option>' +
        allUsers.map(user => `<option value="${user.email}">${user.name}</option>`).join('');
}

function showView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });
    
    // Show selected view
    const view = document.getElementById(`${viewId}-view`);
    if (view) {
        view.style.display = 'block';
        
        // Load data for the view
        switch(viewId) {
            case 'all-tasks':
                renderAllTasks();
                break;
            case 'manage-users':
                loadAllUsers();
                break;
            case 'system-logs':
                loadSystemLogs();
                break;
        }
    }
}

function renderAllTasks() {
    const tableBody = document.getElementById('allTasksTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    allTasks.forEach(task => {
        const row = document.createElement('tr');
        const createdDate = new Date(task.created_at).toLocaleDateString();
        
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.title}</td>
            <td>${task.zone}</td>
            <td><span class="priority-badge priority-${task.priority}">${task.priority}</span></td>
            <td><span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span></td>
            <td>${task.requested_by_name}</td>
            <td>${createdDate}</td>
            <td>
                <div class="task-actions">
                    <button class="btn btn-sm" onclick="editTask(${task.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="showDeleteTaskModal(${task.id}, '${task.title}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function editTask(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const modal = document.getElementById('editTaskModal');
    const form = document.getElementById('editTaskForm');
    
    form.innerHTML = `
        <form onsubmit="updateTask(${taskId}, event)">
            <div class="form-group">
                <label for="editTaskTitle">Title</label>
                <input type="text" id="editTaskTitle" class="form-control" value="${task.title}" required>
            </div>
            
            <div class="form-group">
                <label for="editTaskDescription">Description</label>
                <textarea id="editTaskDescription" class="form-control" rows="3" required>${task.description}</textarea>
            </div>
            
            <div class="form-group">
                <label for="editTaskZone">Zone</label>
                <select id="editTaskZone" class="zone-select" required>
                    <option value="">Select Zone</option>
                    <!-- Zones would be populated here -->
                </select>
            </div>
            
            <div class="form-group">
                <label for="editTaskPriority">Priority</label>
                <select id="editTaskPriority" class="form-control">
                    <option value="normal" ${task.priority === 'normal' ? 'selected' : ''}>Normal</option>
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                    <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="editTaskStatus">Status</label>
                <select id="editTaskStatus" class="form-control">
                    <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="approved" ${task.status === 'approved' ? 'selected' : ''}>Approved</option>
                    <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="rejected" ${task.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="editDueDate">Due Date</label>
                <input type="date" id="editDueDate" class="form-control" value="${task.due_date || ''}">
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn" onclick="closeEditTaskModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Update Task</button>
            </div>
        </form>
    `;
    
    // Set the selected zone
    setTimeout(() => {
        const zoneSelect = document.getElementById('editTaskZone');
        if (zoneSelect) {
            zoneSelect.value = task.zone;
        }
    }, 100);
    
    modal.classList.add('show');
}

async function updateTask(taskId, e) {
    e.preventDefault();
    
    const updates = {
        title: document.getElementById('editTaskTitle').value,
        description: document.getElementById('editTaskDescription').value,
        zone: document.getElementById('editTaskZone').value,
        priority: document.getElementById('editTaskPriority').value,
        status: document.getElementById('editTaskStatus').value,
        due_date: document.getElementById('editDueDate').value || null
    };
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
            credentials: 'include'
        });
        
        if (response.ok) {
            showAlert('Task updated successfully!', 'success');
            closeEditTaskModal();
            await loadSystemDashboard();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to update task', 'error');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

function showDeleteTaskModal(taskId, taskTitle) {
    deleteType = 'task';
    deleteId = taskId;
    
    document.getElementById('deleteMessage').textContent = 
        `Are you sure you want to delete task #${taskId}: "${taskTitle}"? This action cannot be undone.`;
    
    document.getElementById('confirmDeleteModal').classList.add('show');
}

function showDeleteUserModal(userEmail, userName) {
    deleteType = 'user';
    deleteId = userEmail;
    
    document.getElementById('deleteMessage').textContent = 
        `Are you sure you want to delete user "${userName}" (${userEmail})? This action cannot be undone.`;
    
    document.getElementById('confirmDeleteModal').classList.add('show');
}

async function confirmDelete() {
    try {
        let response;
        
        if (deleteType === 'task') {
            response = await fetch(`/api/tasks/${deleteId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } else if (deleteType === 'user') {
            // Note: In production, you'd have a user delete endpoint
            showAlert('User deletion not implemented in this demo', 'error');
            closeDeleteModal();
            return;
        }
        
        if (response && response.ok) {
            showAlert(`${deleteType === 'task' ? 'Task' : 'User'} deleted successfully!`, 'success');
            await loadSystemDashboard();
        } else if (response) {
            const error = await response.json();
            showAlert(error.error || `Failed to delete ${deleteType}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        closeDeleteModal();
    }
}

function editUser(email) {
    // Hide all edit forms
    document.querySelectorAll('.edit-user-form').forEach(form => {
        form.classList.remove('show');
    });
    
    // Show edit form for this user
    const editForm = document.getElementById(`edit-form-${email}`);
    if (editForm) {
        editForm.classList.add('show');
    }
}

function cancelEdit(email) {
    const editForm = document.getElementById(`edit-form-${email}`);
    if (editForm) {
        editForm.classList.remove('show');
    }
}

async function updateUser(email, e) {
    e.preventDefault();
    
    const updates = {
        name: document.getElementById(`edit-name-${email}`).value,
        department: document.getElementById(`edit-dept-${email}`).value,
        zone: document.getElementById(`edit-zone-${email}`).value,
        role: document.getElementById(`edit-role-${email}`).value
    };
    
    const newPassword = document.getElementById(`edit-password-${email}`).value;
    if (newPassword) {
        updates.password = newPassword;
    }
    
    try {
        // Note: In production, you'd have a user update endpoint
        showAlert('User update not implemented in this demo', 'info');
        cancelEdit(email);
    } catch (error) {
        console.error('Error updating user:', error);
        showAlert('Failed to update user', 'error');
    }
}

async function toggleUserStatus(email, currentStatus) {
    try {
        // Note: In production, you'd have a user status toggle endpoint
        showAlert('User status toggle not implemented in this demo', 'info');
    } catch (error) {
        console.error('Error toggling user status:', error);
        showAlert('Failed to update user status', 'error');
    }
}

function showAddUserModal() {
    document.getElementById('addUserModal').classList.add('show');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('show');
    document.getElementById('addUserForm').reset();
}

async function submitNewUser() {
    // Note: In production, you'd submit this to a user creation endpoint
    showAlert('User creation not implemented in this demo', 'info');
    closeAddUserModal();
}

function closeEditTaskModal() {
    document.getElementById('editTaskModal').classList.remove('show');
}

function closeDeleteModal() {
    document.getElementById('confirmDeleteModal').classList.remove('show');
    deleteType = '';
    deleteId = null;
}

async function exportTasksToExcel() {
    try {
        const response = await fetch('/api/tasks/export/excel', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tasks_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showAlert('Tasks exported successfully!', 'success');
        } else {
            showAlert('Failed to export tasks', 'error');
        }
    } catch (error) {
        console.error('Error exporting tasks:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

function exportUsersToExcel() {
    showAlert('User export not implemented in this demo', 'info');
}

function exportLogsToExcel() {
    showAlert('Logs export not implemented in this demo', 'info');
}

function filterTasks() {
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    
    let filteredTasks = allTasks;
    
    if (status) {
        filteredTasks = filteredTasks.filter(task => task.status === status);
    }
    
    if (priority) {
        filteredTasks = filteredTasks.filter(task => task.priority === priority);
    }
    
    // Re-render table with filtered tasks
    const tableBody = document.getElementById('allTasksTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    filteredTasks.forEach(task => {
        const row = document.createElement('tr');
        const createdDate = new Date(task.created_at).toLocaleDateString();
        
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.title}</td>
            <td>${task.zone}</td>
            <td><span class="priority-badge priority-${task.priority}">${task.priority}</span></td>
            <td><span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span></td>
            <td>${task.requested_by_name}</td>
            <td>${createdDate}</td>
            <td>
                <div class="task-actions">
                    <button class="btn btn-sm" onclick="editTask(${task.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="showDeleteTaskModal(${task.id}, '${task.title}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function filterLogs() {
    const date = document.getElementById('logDateFilter').value;
    const user = document.getElementById('logUserFilter').value;
    
    let filteredLogs = allLogs;
    
    if (date) {
        filteredLogs = filteredLogs.filter(log => {
            const logDate = new Date(log.timestamp).toISOString().split('T')[0];
            return logDate === date;
        });
    }
    
    if (user) {
        filteredLogs = filteredLogs.filter(log => log.user_email === user);
    }
    
    // Re-render table with filtered logs
    const tableBody = document.getElementById('systemLogsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = filteredLogs.slice(0, 100).map(log => `
        <tr>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td>${log.user_name || 'System'}</td>
            <td><span class="status-badge">${log.action}</span></td>
            <td>${log.details || '-'}</td>
            <td>${log.task_id || '-'}</td>
        </tr>
    `).join('');
}

function refreshSystemDashboard() {
    loadSystemDashboard();
    showAlert('System dashboard refreshed', 'info');
}

function showAlert(message, type) {
    const alertArea = document.getElementById('alertArea');
    const alertDiv = document.createElement('div');
    
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        ${message}
    `;
    
    alertArea.appendChild(alertDiv);
    
    // Remove alert after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

async function logout() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.href = '/login';
    }
}