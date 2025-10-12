document.addEventListener('DOMContentLoaded', function() {
    // --- Global State & Element Cache ---
    let filesArray = [];
    let currentSortCriteria = 'date'; 
    let currentUserPermissions = 'read';
    let eventSource = null;
    let dragDepth = 0;
    let currentDeleteFilename = null;

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
        authForm: document.getElementById('auth-form'),
        formTitle: document.getElementById('form-title'),
        submitBtn: document.getElementById('submit-btn'),
        registerToggle: document.getElementById('register-toggle'),
        loginToggle: document.getElementById('login-toggle'),
        registerPrompt: document.getElementById('register-prompt'),
        loginPrompt: document.getElementById('login-prompt'),
        errorMessage: document.getElementById('error-message'),
        successMessage: document.getElementById('success-message'),
        fileInput: document.getElementById('file-input'),
        selectFileBtn: document.getElementById('select-file-btn'),
        deleteModal: document.getElementById('delete-modal'),
        deleteModalTitle: document.getElementById('delete-modal-title'),
        deleteConfirmBtn: document.getElementById('delete-confirm-btn'),
        deleteCancelBtn: document.getElementById('delete-cancel-btn'),
        sortDropdown: document.querySelector('.sort-dropdown'),
    };

    // --- Main Initialization ---
    function init() {
        if (!DOMElements.appRoot || DOMElements.appRoot.style.display === 'none') {
            setupAuthForm();
            return;
        }

        currentUserPermissions = DOMElements.floatingMenu.dataset.permissions;
        
        try {
            const initialFilesScript = document.getElementById('initial-files');
            filesArray = JSON.parse(initialFilesScript.textContent);
        } catch (e) {
            console.error("Could not parse initial files:", e);
        }
        
        setupEventSource();
        setupEventListeners();
        DOMElements.cardRoot.classList.add('app-expanded');
        updateUserCapabilities(currentUserPermissions);
        renderFileList();
    }

    // --- Event Setup ---
    function setupEventListeners() {
        if (DOMElements.selectFileBtn) DOMElements.selectFileBtn.addEventListener('click', () => DOMElements.fileInput.click());
        if (DOMElements.fileInput) DOMElements.fileInput.addEventListener('change', handleFileInputChange);
        
        DOMElements.deleteCancelBtn.addEventListener('click', closeDeleteModal);
        DOMElements.deleteModal.addEventListener('click', e => e.target === DOMElements.deleteModal && closeDeleteModal());
        DOMElements.deleteConfirmBtn.addEventListener('click', handleDeleteConfirm);

        document.body.addEventListener('click', handleBodyClick);
        DOMElements.floatingMenu.addEventListener('click', handleMenuClick);
        
        const sortMenu = DOMElements.sortDropdown.querySelector('.sort-menu');
        DOMElements.sortDropdown.querySelector('.sort-btn').addEventListener('click', e => {
            e.stopPropagation();
            sortMenu.style.display = sortMenu.style.display === 'block' ? 'none' : 'block';
        });
        sortMenu.addEventListener('click', handleSortMenuClick);
    }

    function setupAuthForm() {
        DOMElements.registerToggle.addEventListener('click', (e) => { e.preventDefault(); switchAuthMode('register'); });
        DOMElements.loginToggle.addEventListener('click', (e) => { e.preventDefault(); switchAuthMode('login'); });
        DOMElements.authForm.addEventListener('input', hideAuthMessages);
    }

    // --- Event Handlers ---
    function handleFileInputChange(e) {
        if (e.target.files.length) {
            uploadFiles(e.target.files);
            e.target.value = '';
        }
    }
    
    function handleSortMenuClick(e) {
        if (e.target.dataset.sort) {
            sortFiles(e.target.dataset.sort);
            e.currentTarget.style.display = 'none';
        }
    }

    function handleBodyClick(e) {
        const menu = DOMElements.floatingMenu;
        if (!menu.contains(e.target)) hideMenu();
        if (DOMElements.sortDropdown && !DOMElements.sortDropdown.contains(e.target)) {
            DOMElements.sortDropdown.querySelector('.sort-menu').style.display = 'none';
        }
        const trigger = e.target.closest('.menu-trigger');
        if (trigger) {
            e.stopPropagation();
            showMenu(trigger);
        }
    }
    
    function handleMenuClick(e) {
        const target = e.target;
        const filename = target.dataset.filename;
        if (target.classList.contains('fm-download')) {
            window.location.href = '/Uploads/' + encodeURIComponent(filename);
        } else if (target.classList.contains('fm-delete')) {
            currentDeleteFilename = filename;
            DOMElements.deleteModalTitle.textContent = `Delete "${currentDeleteFilename}"?`;
            DOMElements.deleteModal.style.display = 'flex';
        }
        hideMenu();
    }

    async function handleDeleteConfirm() {
        if (!currentDeleteFilename) return;
        try {
            const res = await fetch('/delete/' + encodeURIComponent(currentDeleteFilename), { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).error || 'Could not delete');
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
        closeDeleteModal();
    }

    // --- Auth & Permissions ---
    function switchAuthMode(mode) {
        const isRegister = mode === 'register';
        DOMElements.authForm.action = isRegister ? '/register' : '/login';
        DOMElements.formTitle.textContent = isRegister ? 'Create Account' : 'Welcome back';
        DOMElements.submitBtn.textContent = isRegister ? 'Register' : 'Sign in';
        DOMElements.registerPrompt.style.display = isRegister ? 'none' : 'block';
        DOMElements.loginPrompt.style.display = isRegister ? 'block' : 'none';
        hideAuthMessages();
    }

    function hideAuthMessages() {
        if (DOMElements.errorMessage) DOMElements.errorMessage.style.display = 'none';
        if (DOMElements.successMessage) DOMElements.successMessage.style.display = 'none';
    }

    function updateUserCapabilities(permission) {
        currentUserPermissions = permission;
        DOMElements.floatingMenu.dataset.permissions = permission;
        
        const canUpload = ['write', 'delete', 'admin'].includes(permission);
        const isAdmin = permission === 'admin';

        DOMElements.uploadPanel.style.display = canUpload ? 'block' : 'none';
        DOMElements.mainContent.classList.toggle('single-panel', !canUpload);
        DOMElements.adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';

        const permissionText = { read: 'Download Only', write: 'Download & Upload', delete: 'Download, Upload & Delete', admin: 'Full Access (Admin)' };
        DOMElements.permissionDisplay.textContent = permissionText[permission] || permission;
        
        if (canUpload) enableGlobalDragAndDrop();
        else disableGlobalDragAndDrop();
    }

    // --- Drag & Drop ---
    function enableGlobalDragAndDrop() {
        document.body.addEventListener('dragenter', handleDrag);
        document.body.addEventListener('dragleave', handleDrag);
        document.body.addEventListener('dragover', handleDrag);
        document.body.addEventListener('drop', handleDrop);
    }
    
    function disableGlobalDragAndDrop() {
        document.body.removeEventListener('dragenter', handleDrag);
        document.body.removeEventListener('dragleave', handleDrag);
        document.body.removeEventListener('dragover', handleDrag);
        document.body.removeEventListener('drop', handleDrop);
    }
    
    function handleDrag(e) { e.preventDefault(); e.stopPropagation(); if (e.type === 'dragenter') dragDepth++; else if (e.type === 'dragleave') dragDepth--; DOMElements.globalOverlay.style.display = dragDepth > 0 ? 'flex' : 'none'; }
    function handleDrop(e) { handleDrag(e); const files = e.dataTransfer.files; if (files && files.length) uploadFiles(files); dragDepth = 0; DOMElements.globalOverlay.style.display = 'none'; }

    // --- File Operations ---
    async function uploadFiles(files) {
        for (const f of files) {
            if (f.size > 16 * 1024 * 1024) { alert(`${f.name} is too large (max 16MB).`); continue; }
            const fd = new FormData(); fd.append('file', f);
            try { const res = await fetch('/upload', { method: 'POST', body: fd }); if (!res.ok) throw new Error((await res.json()).error || 'Upload failed'); } catch (err) { alert('Upload failed: ' + err.message); }
        }
    }

    // --- UI & Rendering ---
    function renderFileList() {
        DOMElements.fileListUI.innerHTML = '';
        sortFiles(currentSortCriteria, false); 
        filesArray.forEach(file => DOMElements.fileListUI.appendChild(createFileRow(file)));
        updateStats();
    }

    function createFileRow(file) {
        const li = document.createElement('li');
        li.id = `file-${file.filename}`;
        li.className = 'file-row';
        li.innerHTML = `<div class="file-icon">${getFileIconHtml(file.filename)}</div><div class="file-meta"><div class="file-name">${escapeHtml(file.filename)}</div><div class="file-sub"><span class="uploader">${escapeHtml(file.uploader)}</span><span class="date">${formatDate(file.upload_time)}</span><span class="size">${formatSize(file.size)}</span></div></div><div class="file-actions"><div class="menu-trigger" data-filename="${escapeHtml(file.filename)}">⋮</div></div>`;
        return li;
    }

    function sortFiles(by, userAction = true) {
        if (userAction) currentSortCriteria = by;
        const compare = (a, b) => (a || '').localeCompare(b || '');
        filesArray.sort((a, b) => {
            if (by === 'name') return compare(a.filename, b.filename);
            if (by === 'uploader') return compare(a.uploader, b.uploader);
            if (by === 'date') return compare(b.upload_time, a.upload_time);
            if (by === 'size') return b.size - a.size;
            return 0;
        });
        if (userAction) renderFileList();
        updateSortUI();
    }
    
    function updateSortUI() {
        DOMElements.sortDropdown.querySelectorAll('.sort-menu button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === currentSortCriteria);
        });
    }
    
    function showMenu(trigger) {
        hideMenu();
        const filename = trigger.dataset.filename;
        const rect = trigger.getBoundingClientRect();
        
        let menuHtml = `<button class="fm-download" data-filename="${escapeHtml(filename)}">Download</button>`;
        if (['delete', 'admin'].includes(currentUserPermissions)) {
            menuHtml += `<button class="fm-delete" data-filename="${escapeHtml(filename)}">Delete</button>`;
        }
        DOMElements.floatingMenu.innerHTML = menuHtml;

        const menuWidth = 150;
        const menuHeight = DOMElements.floatingMenu.offsetHeight;
        DOMElements.floatingMenu.style.left = `${rect.right - menuWidth}px`;
        DOMElements.floatingMenu.style.top = (window.innerHeight - rect.bottom < menuHeight) ? `${rect.top - menuHeight - 5}px` : `${rect.bottom + 5}px`;
        DOMElements.floatingMenu.style.display = 'block';
    }

    function hideMenu() { DOMElements.floatingMenu.style.display = 'none'; }
    function closeDeleteModal() { DOMElements.deleteModal.style.display = 'none'; currentDeleteFilename = null; }
    function highlightNewFile(filename) { const el = document.getElementById(`file-${filename}`); if (el) { el.classList.add('new-highlight'); setTimeout(() => el.classList.remove('new-highlight'), 2300); } }
    function updateStats() { DOMElements.uploadStats.textContent = `${filesArray.length} file${filesArray.length !== 1 ? 's' : ''}`; }

    // --- Helpers ---
    function getFileIconHtml(filename) {
        const ext = (filename.split('.').pop() || '').toLowerCase();
        const iconMap = { pdf: 'fa-file-pdf', docx: 'fa-file-word', xlsx: 'fa-file-excel', png: 'fa-file-image', jpg: 'fa-file-image', zip: 'fa-file-archive' };
        const colorMap = { pdf: '#dc2626', docx: '#2563eb', xlsx: '#16a34a', png: '#ca8a04', jpg: '#ca8a04', zip: '#6b7280' };
        return `<i class="fa-solid ${iconMap[ext] || 'fa-file'}" style="color:${colorMap[ext] || '#4b5563'}"></i>`;
    }
    function formatSize(bytes) { if (!bytes || bytes === 0) return '0 KB'; const kb = bytes / 1024; return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`; }
    function formatDate(iso) { return iso ? iso.split('T')[0] : 'Unknown'; }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

    // --- Server-Sent Events (SSE) ---
    async function handlePermissionUpdate(data) {
        const newPermission = data.new_permission;
        alert(`Your permissions have been updated to: ${newPermission.toUpperCase()}`);
        
        try {
            const response = await fetch('/api/refresh_session');
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Session refresh failed');
            
            updateUserCapabilities(result.permissions);

        } catch (err) {
            console.error('Permission update failed:', err);
            alert('Could not apply new permissions. Please log in again.');
            window.location.href = '/logout';
        }
    }

    function setupEventSource() {
        if (eventSource) eventSource.close();
        eventSource = new EventSource('/events');
        
        eventSource.onmessage = e => {
            try {
                const data = JSON.parse(e.data);
                switch(data.type) {
                    case 'file_added':
                        if (!filesArray.some(f => f.filename === data.file.filename)) {
                            filesArray.push(data.file);
                            renderFileList();
                            highlightNewFile(data.file.filename);
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
        eventSource.onerror = () => { eventSource.close(); setTimeout(setupEventSource, 3000); };
    }

    // --- Start the application ---
    init();
});
//change 7
