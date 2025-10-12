document.addEventListener('DOMContentLoaded', function() {
    // --- General Elements ---
    const appRoot = document.getElementById('app');
    const fileList = document.getElementById('file-list');
    const floatingMenu = document.getElementById('floating-menu');
    const globalOverlay = document.getElementById('global-drop-overlay');
    const uploadStats = document.getElementById('upload-stats');
    const cardRoot = document.getElementById('card-root');

    // --- Auth Form Elements ---
    const authForm = document.getElementById('auth-form');
    const formTitle = document.getElementById('form-title');
    const formSubtitle = document.getElementById('form-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const registerToggle = document.getElementById('register-toggle');
    const loginToggle = document.getElementById('login-toggle');
    const registerPrompt = document.getElementById('register-prompt');
    const loginPrompt = document.getElementById('login-prompt');

    // --- Upload Elements ---
    const dropCover = document.getElementById('drop-cover');
    const fileInput = document.getElementById('file-input');
    const selectFileBtn = document.getElementById('select-file-btn');

    // --- Delete Modal Elements ---
    const deleteModal = document.getElementById('delete-modal');
    const deleteModalTitle = document.getElementById('delete-modal-title');
    const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
    const deleteCancelBtn = document.getElementById('delete-cancel-btn');

    let eventSource = null;
    let dragDepth = 0;
    let currentDeleteFilename = null;

    // --- Initial State Check ---
    const loggedIn = appRoot && appRoot.style.display !== 'none';
    if (loggedIn) {
        const userPermissions = floatingMenu.dataset.permissions;
        if (userPermissions && ['write', 'delete', 'admin'].includes(userPermissions)) {
            enableGlobalDrag();
        }
        setupEventSource();
        if (cardRoot) cardRoot.classList.add('app-expanded');
    }

    // --- Auth Form Switching Logic ---
    if (registerToggle) {
        registerToggle.addEventListener('click', (e) => {
            e.preventDefault();
            authForm.action = '/register';
            formTitle.textContent = 'Create Account';
            formSubtitle.textContent = 'Join the shared folder';
            submitBtn.textContent = 'Register';
            registerPrompt.style.display = 'none';
            loginPrompt.style.display = 'inline';
        });
    }

    if (loginToggle) {
        loginToggle.addEventListener('click', (e) => {
            e.preventDefault();
            authForm.action = '/login';
            formTitle.textContent = 'Welcome back';
            formSubtitle.textContent = 'Sign in to access your shared folder';
            submitBtn.textContent = 'Sign in';
            registerPrompt.style.display = 'inline';
            loginPrompt.style.display = 'none';
        });
    }


    // --- Global Drag & Drop ---
    function enableGlobalDrag() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
            document.body.addEventListener(ev, handleGlobalDrag)
        );
    }

    function handleGlobalDrag(e) {
        e.preventDefault();
        e.stopPropagation();
        switch (e.type) {
            case 'dragenter': dragDepth++; if (globalOverlay) globalOverlay.style.display = 'flex'; break;
            case 'dragover': break;
            case 'dragleave': dragDepth--; if (dragDepth <= 0) resetDragState(); break;
            case 'drop':
                const files = e.dataTransfer.files;
                if (files && files.length) uploadFiles(files);
                resetDragState();
                break;
        }
    }

    function resetDragState() {
        dragDepth = 0;
        if (globalOverlay) globalOverlay.style.display = 'none';
    }

    // --- File Upload ---
    if (dropCover) dropCover.addEventListener('click', () => fileInput && fileInput.click());
    if (selectFileBtn) selectFileBtn.addEventListener('click', () => fileInput && fileInput.click());
    if (fileInput) {
        fileInput.addEventListener('change', e => {
            if (e.target.files.length) {
                uploadFiles(e.target.files);
                fileInput.value = '';
            }
        });
    }

    async function uploadFiles(files) {
        for (const f of files) {
            if (f.size > 16 * 1024 * 1024) {
                alert(`${f.name} is too large (max 16MB).`);
                continue;
            }
            const fd = new FormData();
            fd.append('file', f);
            try {
                const res = await fetch('/upload', { method: 'POST', body: fd });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
                    throw new Error(err.error);
                }
            } catch (err) {
                console.error('Upload error:', err);
                alert('Upload failed: ' + err.message);
            }
        }
    }

     let filesArray = [];
    // --- File List & UI Rendering ---
    function addFileToList(file) {
        const id = `file-${file.filename}`;
        if (document.getElementById(id)) return;
        const li = document.createElement('li');
        li.id = id;
        li.className = 'file-row';
        li.innerHTML = `
            <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">${getFileIconHtml(file.filename)}</div>
            <div class="file-meta">
                <div class="file-name">${escapeHtml(file.filename)}</div>
                <div class="file-sub">
    			<div class="uploader">${file.uploader}</div>
    			<div class="date">${file.upload_time}</div>
    			<div class="size">${formatSize(file.size)}</div>
                </div>
	      </div>
            <div class="file-actions">
		<div class="menu-trigger" data-filename="${escapeHtml(file.filename)}">⋮</div>
            </div>
        `;
        if (fileList) fileList.prepend(li);
        updateStats();
         if (filesArray.some(f => f.filename === file.filename)) return;
         filesArray.push(file);
         renderFileList();
    }

    function renderFileList() {
        if (!fileList) return;
        fileList.innerHTML = ''; // clear current list
        for (const file of filesArray) {
            const li = document.createElement('li');
            li.id = `file-${file.filename}`;
            li.className = 'file-row';
            li.innerHTML = `
                <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center">
                    ${getFileIconHtml(file.filename)}
                </div>
                <div class="file-meta">
                    <div class="file-name">${escapeHtml(file.filename)}</div>
                    <div class="file-sub">
                        <div class="uploader">${file.uploader}</div>
                        <div class="date">${file.upload_time}</div>
                        <div class="size">${formatSize(file.size)}</div>
                    </div>
                </div>
                <div class="file-actions">
                    <div class="menu-trigger" data-filename="${escapeHtml(file.filename)}">⋮</div>
                </div>
            `;
            fileList.appendChild(li);
        }
    }
    function sortFiles(by) {
        switch(by) {
            case 'name':
                filesArray.sort((a, b) => a.filename.localeCompare(b.filename));
                break;
            case 'uploader':
                filesArray.sort((a, b) => a.uploader.localeCompare(b.uploader));
                break;
            case 'date':
                filesArray.sort((a, b) => new Date(b.upload_time) - new Date(a.upload_time));
                break;
            case 'size':
                filesArray.sort((a, b) => b.size - a.size);
                break;
        }
        renderFileList();
    }



    function removeFileFromList(filename) {
        const el = document.getElementById(`file-${filename}`);
        if (el) el.remove();
        updateStats();
    }

    function highlightNewFile(filename) {
        const el = document.getElementById(`file-${filename}`);
        if (el) {
            el.classList.add('new-highlight');
            setTimeout(() => el.classList.remove('new-highlight'), 2300);
        }
    }

    function updateStats() {
        if (uploadStats) uploadStats.textContent = (fileList ? fileList.children.length : 0) + ' files';
    }

    function getFileIconHtml(filename) {
        const ext = (filename.split('.').pop() || '').toLowerCase();
        if (['pdf'].includes(ext)) return `<i class="fa-solid fa-file-pdf" style="font-size:20px;color:#dc2626"></i>`;
        if (['doc','docx'].includes(ext)) return `<i class="fa-solid fa-file-word" style="font-size:20px;color:#2563eb"></i>`;
        if (['xls','xlsx'].includes(ext)) return `<i class="fa-solid fa-file-excel" style="font-size:20px;color:#16a34a"></i>`;
        if (['png','jpg','jpeg','gif'].includes(ext)) return `<i class="fa-solid fa-file-image" style="font-size:20px;color:#ca8a04"></i>`;
        if (['zip','rar','7z'].includes(ext)) return `<i class="fa-solid fa-file-archive" style="font-size:20px;color:#6b7280"></i>`;
        return `<i class="fa-solid fa-file" style="font-size:20px;color:#4b5563"></i>`;
    }

    function formatSize(bytes) {
        if (!bytes) return '0 KB';
        const kb = bytes / 1024;
        return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
    }

    // --- Floating Menu ---
    document.body.addEventListener('click', e => {
        const trigger = e.target.closest('.menu-trigger');
        if (trigger) {
            e.stopPropagation();
            const filename = trigger.dataset.filename;
            const rect = trigger.getBoundingClientRect();
            
            let menuHtml = `<button class="fm-download">Download</button>`;
            const userPermissions = floatingMenu.dataset.permissions;
            if (userPermissions === 'delete' || userPermissions === 'admin') {
                menuHtml += `<button class="fm-delete">Delete</button>`;
            }
            floatingMenu.innerHTML = menuHtml;

            floatingMenu.querySelector('.fm-download').onclick = () => {
                window.location.href = '/Uploads/' + encodeURIComponent(filename);
                hideMenu();
            };

            if (floatingMenu.querySelector('.fm-delete')) {
                floatingMenu.querySelector('.fm-delete').onclick = () => {
                    currentDeleteFilename = filename;
                    if (deleteModalTitle) deleteModalTitle.textContent = `Delete "${filename}"?`;
                    if (deleteModal) deleteModal.style.display = 'flex';
                    hideMenu();
                };
            }

            floatingMenu.style.left = `${rect.right - 150}px`;
            floatingMenu.style.top = `${rect.bottom + 5}px`;
            floatingMenu.style.display = 'block';

        } else if (!e.target.closest('#floating-menu')) {
            hideMenu();
        }
    });

    function hideMenu() {
        if (floatingMenu) floatingMenu.style.display = 'none';
    }

    document.querySelector('.sort-btn').addEventListener('click', () => {
        const menu = document.querySelector('.sort-menu');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    });

    // Close dropdown if clicked outside
    window.addEventListener('click', e => {
        if (!e.target.matches('.sort-btn')) {
            document.querySelector('.sort-menu').style.display = 'none';
        }
    });


    // --- Delete Modal Logic ---
    if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', closeDeleteModal);
    if (deleteModal) deleteModal.addEventListener('click', e => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener('click', async () => {
            if (!currentDeleteFilename) return;
            try {
                const res = await fetch('/delete/' + encodeURIComponent(currentDeleteFilename), { method: 'DELETE' });
                if (!res.ok) {
                   const err = await res.json().catch(() => ({error: 'Could not delete'}));
                   throw new Error(err.error);
                }
            } catch (err) {
                alert('Delete failed: ' + err.message);
            }
            closeDeleteModal();
        });
    }

    function closeDeleteModal() {
        if (deleteModal) deleteModal.style.display = 'none';
        currentDeleteFilename = null;
    }

    // --- Server-Sent Events (SSE) ---
    function setupEventSource() {
        if (eventSource) eventSource.close();
        eventSource = new EventSource('/events');
        eventSource.onmessage = e => {
            try {
                const data = JSON.parse(e.data);
                if (!fileList) return;
                if (data.type === 'init') {
                    fileList.innerHTML = '';
                    data.files.forEach(addFileToList);
                } else if (data.type === 'file_added') {
                    addFileToList(data.file);
                    highlightNewFile(data.file.filename);
                } else if (data.type === 'file_deleted') {
                    removeFileFromList(data.file.filename);
                }
            } catch (err) {
                console.error('SSE parse error:', err);
            }
        };
        eventSource.onerror = () => {
            console.error('SSE connection lost. Reconnecting...');
            eventSource.close();
            setTimeout(setupEventSource, 3000);
        };
    }
});

