document.addEventListener('DOMContentLoaded', function() {
    let filesArray = [];
    let currentUserPermissions = 'read';
    let eventSource = null;
    let dragDepth = 0;
    let currentDeleteFilename = null;
    let currentSortCriteria = 'date';
    
    // --- FIX: Guard variable to prevent double permission updates ---
    let isUpdatingPermission = false;

    const DOMElements = {
        appRoot: document.getElementById('app'),
        fileListUI: document.getElementById('file-list'),
        floatingMenu: document.getElementById('floating-menu'),
        globalOverlay: document.getElementById('global-drop-overlay'),
        uploadStats: document.getElementById('upload-stats'),
        cardRoot: document.getElementById('card-root'),
        permissionDisplay: document.getElementById('permission-display'),
        adminBtn: document.getElementById('admin-btn'),
        uploadPanel: document.getElementById('upload-panel'),
        mainContent: document.getElementById('main-content'),
        fileInput: document.getElementById('file-input'),
        selectFileBtn: document.getElementById('select-file-btn'),
        deleteModal: document.getElementById('delete-modal'),
        deleteModalTitle: document.getElementById('delete-modal-title'),
        deleteConfirmBtn: document.getElementById('delete-confirm-btn'),
        deleteCancelBtn: document.getElementById('delete-cancel-btn'),
        sortDropdown: document.querySelector('.sort-dropdown'),
    };

    function init() {
        if (!DOMElements.appRoot) return;
        currentUserPermissions = DOMElements.floatingMenu.dataset.permissions;
        try {
            const initialFilesScript = document.getElementById('initial-files');
            if (initialFilesScript) filesArray = JSON.parse(initialFilesScript.textContent);
        } catch (e) { console.error("Could not parse initial files:", e); }
        setupEventListeners();
        setupEventSource();
        DOMElements.cardRoot.classList.add('app-expanded');
        updateUserCapabilities(currentUserPermissions);
        renderFileList();
    }

    function setupEventListeners() {
        if (DOMElements.selectFileBtn) DOMElements.selectFileBtn.addEventListener('click', () => DOMElements.fileInput.click());
        if (DOMElements.fileInput) DOMElements.fileInput.addEventListener('change', (e) => { if (e.target.files.length) { uploadFiles(e.target.files); e.target.value = ''; } });
        if (DOMElements.deleteCancelBtn) DOMElements.deleteCancelBtn.addEventListener('click', closeDeleteModal);
        if (DOMElements.deleteModal) DOMElements.deleteModal.addEventListener('click', (e) => { if (e.target === DOMElements.deleteModal) closeDeleteModal(); });
        if (DOMElements.deleteConfirmBtn) DOMElements.deleteConfirmBtn.addEventListener('click', handleDeleteConfirm);
        document.body.addEventListener('click', handleBodyClick);
        if (DOMElements.floatingMenu) DOMElements.floatingMenu.addEventListener('click', handleMenuClick);
        if (DOMElements.sortDropdown) DOMElements.sortDropdown.addEventListener('click', handleSortClick);
    }

    function handleBodyClick(e) {
        const trigger = e.target.closest('.menu-trigger');
        if (trigger) {
            e.stopPropagation();
            showMenu(trigger);
            return;
        }
        if (DOMElements.floatingMenu && !DOMElements.floatingMenu.contains(e.target)) {
            hideMenu();
        }
        if (DOMElements.sortDropdown && !e.target.closest('.sort-dropdown')) {
            DOMElements.sortDropdown.querySelector('.sort-menu').classList.remove('visible');
        }
    }

    function handleMenuClick(e) {
        const target = e.target.closest('button');
        if (!target) return;
        const filename = target.dataset.filename;
        if (target.classList.contains('fm-download')) window.location.href = '/files/download/' + encodeURIComponent(filename);
        else if (target.classList.contains('fm-delete')) {
            currentDeleteFilename = filename;
            DOMElements.deleteModalTitle.textContent = `Delete "${currentDeleteFilename}"?`;
            DOMElements.deleteModal.style.display = 'flex';
        }
        hideMenu();
    }
    
    function handleSortClick(e) {
        const target = e.target.closest('button');
        if (target.classList.contains('sort-btn')) target.nextElementSibling.classList.toggle('visible');
        if (target.dataset.sort) {
            currentSortCriteria = target.dataset.sort;
            renderFileList();
            DOMElements.sortDropdown.querySelectorAll('.sort-menu button').forEach(btn => btn.classList.toggle('active', btn.dataset.sort === currentSortCriteria));
            target.closest('.sort-menu').classList.remove('visible');
        }
    }

    async function handleDeleteConfirm() {
        if (!currentDeleteFilename) return;
        try {
            const res = await fetch('/files/delete/' + encodeURIComponent(currentDeleteFilename), { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).error || 'Could not delete file');
            showToast('File deleted successfully.', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
        closeDeleteModal();
    }

    function updateUserCapabilities(permission) {
        currentUserPermissions = permission;
        if (DOMElements.floatingMenu) DOMElements.floatingMenu.dataset.permissions = permission;

        // --- FIX: This updates the header text ---
        if (DOMElements.permissionDisplay) {
            let permissionText = permission;
            if (permission === 'read') permissionText = 'Download Only';
            else if (permission === 'write') permissionText = 'Download & Upload';
            else if (permission === 'delete') permissionText = 'Full Permissions';
            else if (permission === 'admin') permissionText = 'Administrator';
            DOMElements.permissionDisplay.textContent = permissionText;
        }
        // --- END FIX ---

        const canUpload = ['write', 'delete', 'admin'].includes(permission);
        const isAdmin = permission === 'admin';
        if (DOMElements.uploadPanel) DOMElements.uploadPanel.style.display = canUpload ? 'flex' : 'none';
        if (DOMElements.mainContent) DOMElements.mainContent.classList.toggle('single-panel', !canUpload);
        if (DOMElements.adminBtn) DOMElements.adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        if (canUpload) enableGlobalDragAndDrop();
        else disableGlobalDragAndDrop();
    }

    function enableGlobalDragAndDrop() { ['dragenter', 'dragleave', 'dragover', 'drop'].forEach(eventName => document.body.addEventListener(eventName, handleDrag)); }
    function disableGlobalDragAndDrop() { ['dragenter', 'dragleave', 'dragover', 'drop'].forEach(eventName => document.body.removeEventListener(eventName, handleDrag)); }

    function handleDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter') dragDepth++;
        else if (e.type === 'dragleave') dragDepth--;
        else if (e.type === 'drop') {
            dragDepth = 0;
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
        }
        if (DOMElements.globalOverlay) DOMElements.globalOverlay.style.display = dragDepth > 0 ? 'flex' : 'none';
    }

    async function uploadFiles(files) {
        if (DOMElements.uploadPanel) DOMElements.uploadPanel.style.opacity = '0.5';
        for (const f of files) {
            if (f.size > 16 * 1024 * 1024) { showToast(`${f.name} is too large (max 16MB).`, 'error'); continue; }
            const fd = new FormData();
            fd.append('file', f);
            try {
                const res = await fetch('/files/upload', { method: 'POST', body: fd });
                if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
            } catch (err) { showToast(err.message, 'error'); }
        }
        if (DOMElements.uploadPanel) DOMElements.uploadPanel.style.opacity = '1';
    }

    function sortFiles() {
        const getExtension = (filename) => (filename.split('.').pop() || '').toLowerCase();
        const compare = (a, b) => (a || '').toString().localeCompare((b || '').toString(), undefined, { numeric: true });
        filesArray.sort((a, b) => {
            switch (currentSortCriteria) {
                case 'name': return compare(a.filename, b.filename);
                case 'uploader': return compare(a.uploader, b.uploader);
                case 'size': return b.size - a.size;
                case 'type': return compare(getExtension(a.filename), getExtension(b.filename));
                case 'date': default: return new Date(b.upload_time) - new Date(a.upload_time);
            }
        });
    }

    function renderFileList() {
        if (!DOMElements.fileListUI) return;
        sortFiles();
        DOMElements.fileListUI.innerHTML = '';
        filesArray.forEach(file => DOMElements.fileListUI.appendChild(createFileRow(file)));
        updateStats();
    }

    function createFileRow(file) {
        const li = document.createElement('li');
        li.id = `file-${file.filename.replace(/[^a-zA-Z0-9]/g, '-')}`;
        li.className = 'file-row';
        li.innerHTML = `
            <div class="file-icon">${getFileIconHtml(file.filename)}</div>
            <div class="file-meta">
                <div class="file-name" title="${escapeHtml(file.filename)}">${escapeHtml(file.filename)}</div>
                <div class="file-sub">
                    <span class="meta-item"><i class="fa-solid fa-user"></i><span class="uploader">${escapeHtml(file.uploader)}</span></span>
                    <span class="meta-item"><i class="fa-solid fa-calendar-days"></i><span class="date">${formatDate(file.upload_time)}</span></span>
                    <span class="meta-item"><i class="fa-solid fa-hard-drive"></i><span class="size">${formatSize(file.size)}</span></span>
                </div>
            </div>
            <div class="file-actions">
                <button class="menu-trigger" data-filename="${escapeHtml(file.filename)}" aria-label="File options">⋮</button>
            </div>`;
        return li;
    }
    
    function showMenu(trigger) {
        hideMenu();
        const filename = trigger.dataset.filename;
        const rect = trigger.getBoundingClientRect();
        let menuHtml = `<button class="fm-download" data-filename="${escapeHtml(filename)}"><i class="fa-solid fa-download"></i> Download</button>`;
        if (['delete', 'admin'].includes(currentUserPermissions)) menuHtml += `<button class="fm-delete" data-filename="${escapeHtml(filename)}"><i class="fa-solid fa-trash-can"></i> Delete</button>`;
        DOMElements.floatingMenu.innerHTML = menuHtml;
        const menuHeight = DOMElements.floatingMenu.offsetHeight;
        DOMElements.floatingMenu.style.left = `${rect.right - 150}px`;
        DOMElements.floatingMenu.style.top = (window.innerHeight - rect.bottom < menuHeight + 10) ? `${rect.top - menuHeight - 5}px` : `${rect.bottom + 5}px`;
        DOMElements.floatingMenu.style.display = 'block';
    }

    function hideMenu() { if (DOMElements.floatingMenu) DOMElements.floatingMenu.style.display = 'none'; }
    function closeDeleteModal() { if (DOMElements.deleteModal) DOMElements.deleteModal.style.display = 'none'; currentDeleteFilename = null; }
    function highlightNewFile(filename) { const el = document.getElementById(`file-${filename.replace(/[^a-zA-Z0-9]/g, '-')}`); if (el) { el.classList.add('new-highlight'); setTimeout(() => el.classList.remove('new-highlight'), 2300); } }
    function updateStats() { if(DOMElements.uploadStats) DOMElements.uploadStats.textContent = `${filesArray.length} file${filesArray.length !== 1 ? 's' : ''}`; }

    function getFileIconHtml(filename) {
        const ext = (filename.split('.').pop() || '').toLowerCase();
        const iconMap = { pdf: 'fa-file-pdf', docx: 'fa-file-word', xlsx: 'fa-file-excel', pptx: 'fa-file-powerpoint', png: 'fa-file-image', jpg: 'fa-file-image', jpeg: 'fa-file-image', zip: 'fa-file-archive', mp4: 'fa-file-video', mov: 'fa-file-video' };
        const colorMap = { pdf: '#dc2626', docx: '#2563eb', xlsx: '#16a34a', pptx: '#d97706', png: '#4f46e5', jpg: '#4f46e5', jpeg: '#4f46e5', zip: '#4b5563', mp4: '#7c3aed', mov: '#7c3aed' };
        return `<i class="fa-solid ${iconMap[ext] || 'fa-file'}" style="color:${colorMap[ext] || '#4b5563'}"></i>`;
    }

    function formatSize(bytes) { if (!bytes || bytes === 0) return '0 KB'; const kb = bytes / 1024; return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`; }
    function formatDate(iso) { return iso ? new Date(iso).toLocaleDateString() : 'Unknown'; }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const iconMap = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
        toast.innerHTML = `<i class="fa-solid ${iconMap[type]}"></i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('visible'), 10);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    async function handlePermissionUpdate(data) {
        // --- FIX: Prevents the function from running twice ---
        if (isUpdatingPermission) return;
        isUpdatingPermission = true;
        // --- END FIX ---

        const newPermission = data.new_permission;
        showToast(`Permissions updated to: ${newPermission.charAt(0).toUpperCase() + newPermission.slice(1)}`, 'info');
        currentUserPermissions = newPermission;
        updateUserCapabilities(newPermission); // This updates the UI immediately
        
        if (window.location.pathname.startsWith('/admin') && newPermission !== 'admin') {
            window.location.href = '/files';
            return;
        }
        try {
            // We still refresh the session to keep it in sync
            const response = await fetch('/api/refresh_session');
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error('Session refresh failed');
            // We can even call this again to be 100% sure the UI is correct
            updateUserCapabilities(result.permissions);
        } catch (err) {
            showToast(err.message, 'error');
        }
        
        // --- FIX: Releases the guard ---
        setTimeout(() => { isUpdatingPermission = false; }, 200); // Small delay to prevent race conditions
    
    }

    function setupEventSource() {
        if (eventSource) eventSource.close();
        eventSource = new EventSource('/events/');
        eventSource.onmessage = e => {
            try {
                const data = JSON.parse(e.data);
                switch(data.type) {
                    case 'file_added':
                        if (!filesArray.some(f => f.filename === data.file.filename)) {
                            filesArray.unshift(data.file);
                            renderFileList();
                            highlightNewFile(data.file.filename);
                            // --- FIX: Only show toast if *another* user added the file ---
                            if (data.file.uploader !== DOMElements.floatingMenu.dataset.username) {
                                showToast(`New file: ${data.file.filename}`, 'success');
                            }
                        }
                        break;
                    case 'file_deleted':
                        filesArray = filesArray.filter(f => f.filename !== data.file.filename);
                        renderFileList();
                        break;
                    case 'permission_updated':
                        handlePermissionUpdate(data.data);
                        break;
                }
            } catch (err) { console.error('SSE parse error:', err); }
        };
        eventSource.onerror = () => { if(eventSource) eventSource.close(); setTimeout(setupEventSource, 5000); };
    }

    init();
});