let currentUser = null;
let currentTaskId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadUserInfo();
    loadTasks();
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
        if (currentUser.role !== 'team') {
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

    // Task request form
    document.getElementById('requestTaskForm').addEventListener('submit', submitTaskRequest);

    // Modal close on background click
    document.getElementById('taskDetailsModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    });

    document.getElementById('completeTaskModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeCompleteModal();
        }
    });
}

function loadUserInfo() {
    if (!currentUser) return;
    
    const userInfoDiv = document.getElementById('userInfo');
    userInfoDiv.innerHTML = `
        <div class="user-avatar">${currentUser.name.charAt(0)}</div>
        <div class="user-details">
            <h3>${currentUser.name}</h3>
            <p>${currentUser.department || 'Team Member'} • ${currentUser.zone || 'All Zones'}</p>
        </div>
        <button class="logout-btn" id="logoutBtn">
            <i class="fas fa-sign-out-alt"></i> Logout
        </button>
    `;
    
    // Re-attach logout listener
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const tasks = await response.json();
            renderTasks(tasks);
            updateStatistics(tasks);
        } else {
            showAlert('Failed to load tasks', 'error');
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

function renderTasks(tasks) {
    const tableBody = document.getElementById('tasksTableBody');
    const completedBody = document.getElementById('completedTasksBody');
    
    if (!tableBody || !completedBody) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    completedBody.innerHTML = '';
    
    tasks.forEach(task => {
        const row = createTaskRow(task);
        
        if (task.status === 'completed') {
            completedBody.appendChild(row);
        } else {
            tableBody.appendChild(row);
        }
    });
}

function createTaskRow(task) {
    const row = document.createElement('tr');
    
    // Format date
    const createdDate = new Date(task.created_at).toLocaleDateString();
    const completedDate = task.completed_at ? new Date(task.completed_at).toLocaleDateString() : '';
    
    if (task.status === 'completed') {
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.title}</td>
            <td>${task.zone}</td>
            <td>${completedDate}</td>
            <td>${task.remarks || '-'}</td>
            <td>${task.approved_by_name || 'Not Approved'}</td>
        `;
    } else {
        row.innerHTML = `
            <td>${task.id}</td>
            <td>${task.title}</td>
            <td>${task.zone}</td>
            <td><span class="priority-badge priority-${task.priority}">${task.priority}</span></td>
            <td><span class="status-badge status-${task.status}">${task.status.replace('_', ' ')}</span></td>
            <td>${task.approved_by_name || 'Pending'}</td>
            <td>${createdDate}</td>
            <td>
                <div class="task-actions">
                    <button class="btn btn-sm" onclick="viewTaskDetails(${task.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${task.status === 'approved' || task.status === 'in_progress' ? `
                    <button class="btn btn-sm btn-secondary" onclick="openCompleteModal(${task.id})">
                        <i class="fas fa-check"></i> Complete
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
    }
    
    return row;
}

async function viewTaskDetails(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/logs`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const logs = await response.json();
            showTaskDetails(taskId, logs);
        }
    } catch (error) {
        console.error('Error loading task logs:', error);
    }
}

function showTaskDetails(taskId, logs) {
    // Find task in current tasks
    // This is a simplified version - in production, you'd fetch the task details
    const modal = document.getElementById('taskDetailsModal');
    const content = document.getElementById('taskDetailsContent');
    const footer = document.getElementById('taskModalFooter');
    
    // For now, we'll show basic info
    content.innerHTML = `
        <h3>Task #${taskId}</h3>
        <p><strong>Logs:</strong></p>
        <ul>
            ${logs.map(log => `
                <li>
                    <strong>${log.user_name}</strong> ${log.action} 
                    <small>${new Date(log.timestamp).toLocaleString()}</small>
                    ${log.details ? `<br><em>${log.details}</em>` : ''}
                </li>
            `).join('')}
        </ul>
    `;
    
    footer.innerHTML = `
        <button class="btn" onclick="closeModal()">Close</button>
    `;
    
    modal.classList.add('show');
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
            case 'my-tasks':
                loadTasks();
                break;
            case 'stats':
                loadStatistics();
                break;
        }
    }
}

async function submitTaskRequest(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    // Disable button and show loading
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        zone: document.getElementById('taskZone').value,
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('dueDate').value || null
    };
    
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
            showAlert('Task request submitted successfully!', 'success');
            form.reset();
            
            // Switch to tasks view
            showView('my-tasks');
            loadTasks();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to submit task', 'error');
        }
    } catch (error) {
        console.error('Error submitting task:', error);
        showAlert('Network error. Please try again.', 'error');
    } finally {
        // Restore button
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

function openCompleteModal(taskId) {
    currentTaskId = taskId;
    document.getElementById('completeTaskModal').classList.add('show');
}

function closeCompleteModal() {
    document.getElementById('completeTaskModal').classList.remove('show');
    document.getElementById('completionRemarks').value = '';
    currentTaskId = null;
}

async function submitCompletion() {
    const remarks = document.getElementById('completionRemarks').value;
    
    if (!remarks.trim()) {
        showAlert('Please provide completion remarks', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${currentTaskId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ remarks }),
            credentials: 'include'
        });
        
        if (response.ok) {
            showAlert('Task marked as completed!', 'success');
            closeCompleteModal();
            loadTasks();
        } else {
            const error = await response.json();
            showAlert(error.error || 'Failed to complete task', 'error');
        }
    } catch (error) {
        console.error('Error completing task:', error);
        showAlert('Network error. Please try again.', 'error');
    }
}

function updateStatistics(tasks) {
    const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length
    };
    
    document.getElementById('totalTasks').textContent = stats.total;
    document.getElementById('pendingTasks').textContent = stats.pending;
    document.getElementById('inProgressTasks').textContent = stats.inProgress;
    document.getElementById('completedTasks').textContent = stats.completed;
}

async function loadStatistics() {
    try {
        const response = await fetch('/api/tasks/stats', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const stats = await response.json();
            // Update stats cards if needed
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function refreshTasks() {
    loadTasks();
    showAlert('Tasks refreshed', 'info');
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