let currentUser = null;
let allTasks = [];
let allUsers = [];
let currentTaskId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadUserInfo();
    loadDashboardData();
    populateZones();
});

async function checkAuth() {
    try {
        const response = await fetch('/api/session');
        const data = await response.json();
        
        if (!data.loggedIn) {
            window.location.href = '/login';
            return;
        }
        
        currentUser = data.user;
        
        // Redirect to correct dashboard based on role
        if (currentUser.role === 'team') {
            window.location.href = '/dashboard';
        }
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

    // Create task form
    document.getElementById('createTaskForm').addEventListener('submit', submitCreateTask);

    // Export date range toggle
    document.getElementById('exportDateRange').addEventListener('change', function() {
        const customRangeDiv = document.getElementById('customDateRange');
        customRangeDiv.style.display = this.value === 'custom' ? 'block' : 'none';
    });

    // Modal close on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                if (modal.id === 'taskDetailsModal') closeModal();
                if (modal.id === 'assignTaskModal') closeAssignModal();
            }
        });
    });
}

function loadUserInfo() {
    if (!currentUser) return;
    
    const userInfoDiv = document.getElementById('userInfo');
    userInfoDiv.innerHTML = `
        <div class="user-avatar">${currentUser.name.charAt(0)}</div>
        <div class="user-details">
            <h3>${currentUser.name}</h3>
            <p>${currentUser.role === 'system_admin' ? 'System Administrator' : 'Administrator'}</p>
        </div>
        <button class="logout-btn" id="logoutBtn">
            <i class="fas fa-sign-out-alt"></i> Logout
        </button>
    `;
    
    // Re-attach logout listener
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

async function loadDashboardData() {
    try {
        // Load tasks
        const tasksResponse = await fetch('/api/tasks', {
            credentials: 'include'
        });
        
        if (tasksResponse.ok) {
            allTasks = await tasksResponse.json();
            updateDashboardStats();
            renderAllTasks();
            renderPendingTasks();
        }
        
        // Load users
        await loadUsers();
        
        // Load stats
        await loadStats();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('Failed to load dashboard data', 'error');
    }
}

function updateDashboardStats() {
    const stats = {
        total: allTasks.length,
        pending: allTasks.filter(t => t.status === 'pending').length,
        urgent: allTasks.filter(t => t.priority === 'urgent').length,
        completed: allTasks.filter(t => t.status === 'completed').length
    };
    
    document.getElementById('totalTasks').textContent = stats.total;
    document.getElementById('pendingTasks').textContent = stats.pending;
    document.getElementById('urgentTasks').textContent = stats.urgent;
    document.getElementById('completedTasks').textContent = stats.completed;
    
    // Update pending count badge
    document.getElementById('pendingCountBadge').textContent = stats.pending;
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
            <td>${task.assigned_to_name || 'Not Assigned'}</td>
            <td>${task.approved_by_name || 'Pending'}</td>
            <td>${createdDate}</td>
            <td>
                <div class="task-actions">
                    <button class="btn btn-sm" onclick="viewTaskDetails(${task.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${task.status === 'pending' ? `
                    <button class="btn btn-sm btn-primary" onclick="approveTask(${task.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    ` : ''}
                    ${(task.status === 'approved' || task.status === 'pending') && !task.assigned_to ? `
                    <button class="btn btn-sm btn-secondary" onclick="openAssignModal(${task.id})">
                        <i class="fas fa-user-plus"></i> Assign
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function renderPendingTasks() {
    const tableBody = document.getElementById('pendingTasksTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const pendingTasks = allTasks.filter(task => task.status === 'pending');
    
    pendingTasks.forEach(task => {
        const row = document.createElement('tr');
        const createdDate = new Date(task.created_at).toLocaleDateString();
        
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.title}</td>
            <td>${task.zone}</td>
            <td><span class="priority-badge priority-${task.priority}">${task.priority}</span></td>
            <td>${task.requested_by_name}</td>
            <td>${createdDate}</td>
            <td>
                <div class="task-actions">
                    <button class="btn btn-sm" onclick="viewTaskDetails(${task.id})">
                        <i class="fas fa-eye"></i> Details
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="approveTask(${task.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="rejectTask(${task.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

async function loadUsers() {
    try {
        const response = await fetch('/api/tasks/users?role=team', {
            credentials: 'include'
        });
        
        if (response.ok) {
            allUsers = await response.json();
            populateUserSelects();
            renderUserList();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function populateUserSelects() {
    const assignToSelect = document.getElementById('assignTo');
    const assigneeSelect = document.getElementById('assigneeSelect');
    
    if (assignToSelect) {
        assignToSelect.innerHTML = '<option value="">Not Assigned</option>' +
            allUsers.map(user => `<option value="${user.email}">${user.name} (${user.department})</option>`).join('');
    }
    
    if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">Select team member</option>' +
            allUsers.map(user => `<option value="${user.email}" data-name="${user.name}">${user.name} (${user.department})</option>`).join('');
    }
}

function renderUserList() {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;
    
    usersList.innerHTML = allUsers.map(user => `
        <div class="user-card">
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
            </div>
        </div>
    `).join('');
}

function populateZones() {
    const zones = [
        "Main Villa", "Main SPA", "Mountain Villa", "Entourage", "Pool House", 
        "Gate 3", "Golf Landscaping", "Areesh", "MUD 1", "MUD 2", "MUD 3", 
        "MUD 4", "MUD 5", "MUD 6", "Paddle Court", "Gaming Building", 
        "Indian Palace Front", "Indian Palace back", "Royal Caravan", 
        "Cycle Track", "POD 1 Indoor", "POD 1 Out door", "Royal Road", 
        "Gate 5", "VIP Hotel", "Staff Canteen Z1", "Staff Canteen Z2", 
        "Staff Canteen Z3", "Other"
    ];
    
    const zoneSelects = [
        document.getElementById('adminTaskZone'),
        document.getElementById('zoneFilter')
    ];
    
    zoneSelects.forEach(select => {
        if (select) {
            // Keep existing options if any
            const baseOptions = select.innerHTML;
            select.innerHTML = baseOptions + zones.map(zone => 
                `<option value="${zone}">${zone}</option>`
            ).join('');
        }
    });
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
            case 'pending-approval':
                renderPendingTasks();
                break;
            case 'users':
                loadUsers();
                break;
        }
    }
}

async function viewTaskDetails(taskId) {
    try {
        // Fetch task logs
        const logsResponse = await fetch(`/api/tasks/${taskId}/logs`, {
            credentials: 'include'
        });
        
        if (logsResponse.ok) {
            const logs = await response.json();
            const task = allTasks.find(t => t.id === taskId);
            
            if (task) {
                showTaskDetailsModal(task, logs);
            }
        }
    } catch (error) {
        console.error('Error loading task details:', error);
        
        // Fallback: show basic task info
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            showTaskDetailsModal(task, []);
        }
    }
}

function showTaskDetailsModal(task, logs) {
    const modal = document.getElementById('taskDetailsModal');
    const content = document.getElementById('taskDetailsContent');
    const footer = document.getElementById('taskModalFooter');
    
    // Format dates
    const createdDate = new Date(task.created_at).toLocaleString();
    const approvedDate = task.approved_at ? new Date(task.approved_at).toLocaleString() : 'Not approved';
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set';
    const completedDate = task.completed_at ? new Date(task.completed_at).toLocaleString() : 'Not completed';
    
    content.innerHTML = `
        <div style="margin-bottom: 20px;">
            <h3>${task.title}</h3>
            <p><strong>Description:</strong> ${task.description}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
                <p><strong>Zone:</strong> ${task.zone}</p>
                <p><strong>Priority:</strong> <span class="priority-badge priority-${task.priority}">${task.priority}</span></p>
                <p><strong>Status:</strong> <span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span></p>
            </div>
            <div>
                <p><strong>Requested by:</strong> ${task.requested_by_name}</p>
                <p><strong>Assigned to:</strong> ${task.assigned_to_name || 'Not assigned'}</p>
                <p><strong>Approved by:</strong> ${task.approved_by_name || 'Not approved'}</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
                <p><strong>Created:</strong> ${createdDate}</p>
                <p><strong>Approved:</strong> ${approvedDate}</p>
            </div>
            <div>
                <p><strong>Due Date:</strong> ${dueDate}</p>
                <p><strong>Completed:</strong> ${completedDate}</p>
            </div>
        </div>
        
        ${task.remarks ? `<p><strong>Remarks:</strong> ${task.remarks}</p>` : ''}
        
        ${logs.length > 0 ? `
        <div style="margin-top: 20px;">
            <h4>Activity Log</h4>
            <div style="max-height: 200px; overflow-y: auto;">
                ${logs.map(log => `
                    <div style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                        <strong>${log.user_name}</strong> ${log.action}
                        <br><small>${new Date(log.timestamp).toLocaleString()}</small>
                        ${log.details ? `<br><em>${log.details}</em>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    `;
    
    // Set up action buttons
    let actionButtons = '';
    
    if (task.status === 'pending') {
        actionButtons = `
            <button class="btn btn-primary" onclick="approveTask(${task.id}); closeModal()">
                <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn btn-secondary" onclick="openAssignModal(${task.id}); closeModal()">
                <i class="fas fa-user-plus"></i> Assign
            </button>
            <button class="btn btn-danger" onclick="rejectTask(${task.id}); closeModal()">
                <i class="fas fa-times"></i> Reject
            </button>
        `;
    } else if (task.status === 'approved' && !task.assigned_to) {
        actionButtons = `
            <button class="btn btn-secondary" onclick="openAssignModal(${task.id}); closeModal()">
                <i class="fas fa-user-plus"></i> Assign
            </button>
        `;
    } else if (task.status === 'in_progress') {
        actionButtons = `
            <button class="btn btn-primary" onclick="markTaskUrgent(${task.id}); closeModal()">
                <i class="fas fa-exclamation-triangle"></i> Mark as Urgent
            </button>
        `;
    }
    
    footer.innerHTML = `
        <button class="btn" onclick="closeModal()">Close</button>
        ${actionButtons}
    `;
    
    modal.classList.add('show');
}

async function approveTask(taskId) {
    if (!confirm('Are you sure you want to approve this task?')) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}/approve`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            showAlert('Task approved successfully!', 'success');
            await loadDashboardData();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to approve task', 'error');
        }
    } catch (error) {
        console.error('Error approving task:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

async function rejectTask(taskId) {
    if (!confirm('Are you sure you want to reject this task?')) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'rejected' }),
            credentials: 'include'
        });
        
        if (response.ok) {
            showAlert('Task rejected successfully!', 'success');
            await loadDashboardData();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to reject task', 'error');
        }
    } catch (error) {
        console.error('Error rejecting task:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

function openAssignModal(taskId) {
    currentTaskId = taskId;
    document.getElementById('assignTaskModal').classList.add('show');
}

function closeAssignModal() {
    document.getElementById('assignTaskModal').classList.remove('show');
    document.getElementById('assigneeSelect').value = '';
    currentTaskId = null;
}

async function submitAssignment() {
    const assigneeSelect = document.getElementById('assigneeSelect');
    const selectedOption = assigneeSelect.options[assigneeSelect.selectedIndex];
    
    if (!selectedOption.value) {
        showAlert('Please select a team member to assign', 'error');
        return;
    }
    
    const assigneeEmail = selectedOption.value;
    const assigneeName = selectedOption.getAttribute('data-name');
    
    try {
        const response = await fetch(`/api/tasks/${currentTaskId}/assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                assigneeEmail: assigneeEmail,
                assigneeName: assigneeName
            }),
            credentials: 'include'
        });
        
        if (response.ok) {
            showAlert('Task assigned successfully!', 'success');
            closeAssignModal();
            await loadDashboardData();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to assign task', 'error');
        }
    } catch (error) {
        console.error('Error assigning task:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

async function submitCreateTask(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Disable button and show loading
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    
    const taskData = {
        title: document.getElementById('adminTaskTitle').value,
        description: document.getElementById('adminTaskDescription').value,
        zone: document.getElementById('adminTaskZone').value,
        priority: document.getElementById('adminTaskPriority').value,
        due_date: document.getElementById('adminDueDate').value || null,
        requested_by: currentUser.email,
        requested_by_name: currentUser.name
    };
    
    // Add assignment if selected
    const assignTo = document.getElementById('assignTo').value;
    if (assignTo) {
        const selectedUser = allUsers.find(u => u.email === assignTo);
        if (selectedUser) {
            taskData.assigned_to = assignTo;
            taskData.assigned_to_name = selectedUser.name;
            taskData.status = 'in_progress';
        }
    }
    
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData),
            credentials: 'include'
        });
        
        if (response.ok) {
            showAlert('Task created successfully!', 'success');
            form.reset();
            await loadDashboardData();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to create task', 'error');
        }
    } catch (error) {
        console.error('Error creating task:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        // Restore button
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

async function exportToExcel() {
    try {
        const dateRange = document.getElementById('exportDateRange').value;
        let url = '/api/tasks/export/excel';
        
        // Add date range parameters if custom
        if (dateRange === 'custom') {
            const startDate = document.getElementById('exportStartDate').value;
            const endDate = document.getElementById('exportEndDate').value;
            
            if (startDate && endDate) {
                url += `?start_date=${startDate}&end_date=${endDate}`;
            }
        }
        
        // Download the file
        const response = await fetch(url, {
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
            
            showAlert('Excel file downloaded successfully!', 'success');
        } else {
            showAlert('Failed to export data', 'error');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/tasks/stats', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const stats = await response.json();
            // Could update additional stats here
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function refreshDashboard() {
    loadDashboardData();
    showAlert('Dashboard refreshed', 'info');
}

function filterTasks() {
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    const zone = document.getElementById('zoneFilter').value;
    
    let filteredTasks = allTasks;
    
    if (status) {
        filteredTasks = filteredTasks.filter(task => task.status === status);
    }
    
    if (priority) {
        filteredTasks = filteredTasks.filter(task => task.priority === priority);
    }
    
    if (zone) {
        filteredTasks = filteredTasks.filter(task => task.zone === zone);
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
            <td>${task.assigned_to_name || 'Not Assigned'}</td>
            <td>${task.approved_by_name || 'Pending'}</td>
            <td>${createdDate}</td>
            <td>
                <div class="task-actions">
                    <button class="btn btn-sm" onclick="viewTaskDetails(${task.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

async function markTaskUrgent(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ priority: 'urgent' }),
            credentials: 'include'
        });
        
        if (response.ok) {
            showAlert('Task marked as urgent!', 'success');
            await loadDashboardData();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to update task', 'error');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

function closeModal() {
    document.getElementById('taskDetailsModal').classList.remove('show');
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