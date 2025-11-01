document.addEventListener('DOMContentLoaded', () => {
    const userListBody = document.getElementById('user-list');
    const statusMessage = document.getElementById('status-message');
    let statusTimeout;
    let eventSource;

    function createUserRow(user) {
        const tr = document.createElement('tr');
        tr.id = `user-${user.id}`;
        const isCurrentUser = user.username === currentUser;
        tr.innerHTML = `
            <td><strong>${user.username}</strong> ${isCurrentUser ? '<span class="muted">(You)</span>' : ''}</td>
            <td>
                <div class="permission-select-wrapper">
                    <select class="permission-select" data-user-id="${user.id}" ${isCurrentUser ? 'disabled title="Cannot change your own permissions"' : ''}>
                        <option value="read" ${user.permissions === 'read' ? 'selected' : ''}>Read</option>
                        <option value="write" ${user.permissions === 'write' ? 'selected' : ''}>Write</option>
                        <option value="delete" ${user.permissions === 'delete' ? 'selected' : ''}>Delete</option>
                        <option value="admin" ${user.permissions === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
            </td>
            <td>
                <button class="delete-btn" data-user-id="${user.id}" ${isCurrentUser ? 'disabled' : ''} title="Delete user">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        return tr;
    }

    async function fetchUsers() {
        try {
            const response = await fetch('/admin/api/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const users = await response.json();
            userListBody.innerHTML = '';
            users.forEach(user => userListBody.appendChild(createUserRow(user)));
        } catch (error) { showStatus(error.message, 'error'); }
    }

    userListBody.addEventListener('change', async (e) => {
        if (e.target.tagName === 'SELECT') {
            const select = e.target;
            const userId = select.dataset.userId;
            const newPermission = select.value;
            try {
                const res = await fetch('/admin/api/update_permission', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: parseInt(userId), permission: newPermission }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to update');
                showStatus('Permissions updated.', 'success');
                // The real-time event will update the UI, but this is a good fallback
            } catch (error) { showStatus(error.message, 'error'); }
        }
    });

    userListBody.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.delete-btn');
        if (deleteButton && !deleteButton.disabled) {
            const userId = deleteButton.dataset.userId;
            const username = deleteButton.closest('tr').querySelector('strong').textContent;
            // Use a custom modal instead of confirm()
            if (window.confirm(`Are you sure you want to delete user "${username}"?`)) {
                try {
                    const res = await fetch(`/admin/api/delete_user/${userId}`, { method: 'DELETE' });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.error || 'Failed to delete user');
                    // The SSE will handle removing the user from the UI
                } catch (error) { showStatus(error.message, 'error'); }
            }
        }
    });

    function showStatus(message, type) {
        clearTimeout(statusTimeout);
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type} show`;
        statusTimeout = setTimeout(() => statusMessage.classList.remove('show'), 4000);
    }
    
    function setupEventSource() {
        if (eventSource) eventSource.close();
        eventSource = new EventSource('/events/');
        
        eventSource.onmessage = e => {
            try {
                const data = JSON.parse(e.data);
                switch (data.type) {
                    case 'user_registered':
                        const newUser = data.data;
                        if (!document.getElementById(`user-${newUser.id}`)) {
                            userListBody.appendChild(createUserRow(newUser));
                            showStatus(`New user registered: ${newUser.username}`, 'success');
                        }
                        break;
                    case 'user_deleted':
                        const deletedUserRow = document.getElementById(`user-${data.data.id}`);
                        if(deletedUserRow) {
                            deletedUserRow.style.opacity = 0;
                            setTimeout(() => deletedUserRow.remove(), 300);
                        }
                        break;
                    
                    // --- THIS IS THE UPDATED LOGIC ---
                    case 'permission_updated':
                        const eventData = data.data;

                        // Check if this update is for the *current* admin
                        if (eventData.username === currentUser) {
                            // This is an update for *me* (the admin)
                            if (eventData.new_permission !== 'admin') {
                                showStatus("Your admin permissions have been revoked. Redirecting...", "error");
                                setTimeout(() => {
                                    window.location.href = '/files';
                                }, 2500);
                            }
                        } else {
                            // This is an update for *another* user on the list
                            const select = document.querySelector(`select[data-user-id="${eventData.id}"]`);
                            if (select) {
                                select.value = eventData.new_permission;
                                // Highlight the row to show a change
                                const row = select.closest('tr');
                                if (row) {
                                    row.style.transition = 'background-color 0.5s';
                                    row.style.backgroundColor = 'var(--success-bg, #dcfce7)';
                                    setTimeout(() => {
                                        row.style.backgroundColor = '';
                                    }, 2000);
                                }
                            }
                        }
                        break;
                    // --- END OF UPDATED LOGIC ---
                }
            } catch (err) { console.error('SSE Error:', err); }
        };
        eventSource.onerror = () => { if(eventSource) eventSource.close(); setTimeout(setupEventSource, 5000); };
    }

    fetchUsers();
    setupEventSource();
});
