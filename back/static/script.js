const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loginSection = document.getElementById('login-section');
const appRoot = document.getElementById('app');
const greetingEl = document.getElementById('greeting');
const logoutBtn = document.getElementById('logout-btn');
const dropCover = document.getElementById('drop-cover');
const fileList = document.getElementById('file-list');
const fileInput = document.getElementById('file-input');
const selectFileBtn = document.getElementById('select-file-btn');
const floatingMenu = document.getElementById('floating-menu');
const globalOverlay = document.getElementById('global-drop-overlay');
const uploadStats = document.getElementById('upload-stats');
const cardRoot = document.getElementById('card-root');
const deleteModal = document.getElementById('delete-modal');
const deleteModalTitle = document.getElementById('delete-modal-title');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');

let eventSource = null;
let loggedIn = false;
let dragDepth = 0;
let currentDeleteFilename = null;

// Initialize page state on load
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in based on the app display state
    loggedIn = appRoot.style.display !== 'none';
    
    if (loggedIn) {
        enableGlobalDrag();
        setupEventSource();
    } else {
        resetDragState();
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    }
});

// ---------- LOGIN ----------
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    try {
      const res = await fetch('/login', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      if (res.redirected) {
        loginSection.style.display = 'none';
        appRoot.style.display = 'block';
        cardRoot.classList.add('app-expanded');
        loggedIn = true;
        const username = loginForm.elements['username'].value;
        greetingEl.textContent = `Hello, ${username}`;
        enableGlobalDrag();
        setupEventSource();
      } else {
        const txt = await res.text();
        showError('Login failed — check credentials');
        console.error('login failed', txt);
      }
    } catch (err) {
      showError('Network error during login');
      console.error('Login error:', err);
    }
  });
}
function showError(msg) {
  if (errorMessage) {
    errorMessage.style.display = 'block';
    errorMessage.textContent = msg;
  }
}

// ---------- GLOBAL DRAG & DROP ----------
function enableGlobalDrag() {
  ['dragenter', 'dragover', 'dragleave', 'drop', 'dragend'].forEach(ev =>
    document.addEventListener(ev, handleGlobalDrag)
  );
}

function handleGlobalDrag(e) {
  if (!loggedIn) return;
  e.preventDefault();
  e.stopPropagation();
  
  switch (e.type) {
    case 'dragenter':
      dragDepth++;
      globalOverlay.style.display = 'flex';
      dropCover.classList.add('drag');
      break;
    case 'dragover':
      // Keep showing overlay during dragover
      break;
    case 'dragleave':
      dragDepth--;
      if (dragDepth <= 0) {
        resetDragState();
      }
      break;
    case 'drop':
      const files = e.dataTransfer.files;
      if (files && files.length) uploadFiles(files);
      resetDragState();
      break;
    case 'dragend':
      resetDragState();
      break;
  }
}

function resetDragState() {
  dragDepth = 0;
  globalOverlay.style.display = 'none';
  dropCover.classList.remove('drag');
}

if (dropCover) dropCover.addEventListener('click', () => fileInput.click());

// ---------- FILE UPLOAD ----------
// Fix for file input selection issue
if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
      // Reset the input to allow selecting the same file again
      fileInput.value = '';
    }
  });
}

if (selectFileBtn) {
  selectFileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });
}

async function uploadFiles(files) {
  const arr = Array.from(files);
  for (const f of arr) {
    if (f.size > 15 * 1024 * 1024) {
      alert(`${f.name} is larger than 15MB`);
      continue;
    }
    const fd = new FormData();
    fd.append('file', f);
    try {
      const res = await fetch('/upload', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const data = await res.json();
      addFileToList(data);
      highlightNewFile(data.filename);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + err.message);
    }
  }
}

// ---------- FILE LIST ----------
function addFileToList(data) {
  const id = `file-${data.filename}`;
  const existing = document.getElementById(id);
  if (existing) {
    existing.querySelector('.file-sub .date').textContent = data.upload_time;
    return;
  }
  const li = document.createElement('li');
  li.id = id;
  li.className = 'file-row';
  li.innerHTML = `
    <div style="width:44px;height:44px;border-radius:8px;background:linear-gradient(180deg,#eef2ff,#fff);display:flex;align-items:center;justify-content:center;font-weight:700;color:#2563eb">F</div>
    <div class="file-meta">
      <div class="file-name">${escapeHtml(data.filename)}</div>
      <div class="file-sub"><div class="date">${data.upload_time}</div><div>${data.size ? formatSize(data.size) : '—'}</div></div>
    </div>
    <div class="file-actions">
      <div class="menu-trigger" data-filename="${escapeHtml(data.filename)}">⋮</div>
    </div>
  `;
  fileList.prepend(li);
  updateStats();
}

function removeFileFromList(filename) {
  const el = document.getElementById(`file-${filename}`);
  if (el) el.remove();
  updateStats();
}

function highlightNewFile(filename) {
  const el = document.getElementById(`file-${filename}`);
  if (!el) return;
  el.classList.add('new-highlight');
  setTimeout(() => el.classList.remove('new-highlight'), 2400);
}

function updateStats() {
  uploadStats.textContent = fileList.children.length + ' files';
}

function formatSize(n) {
  if (!n) return '';
  const kb = n / 1024;
  if (kb < 1024) return Math.round(kb) + ' KB';
  return (kb / 1024).toFixed(1) + ' MB';
}

function escapeHtml(s) {
  return String(s).replace(/[&"'<>]/g, c => ({'&': '&amp;', '"': '&quot;', '\'': '&#39;', '<': '&lt;', '>': '&gt;'}[c]));
}

// ---------- FLOATING MENU ----------
document.addEventListener('click', e => {
  if (!e.target.closest('.menu-trigger') && floatingMenu && !floatingMenu.contains(e.target)) {
    floatingMenu.style.display = 'none';
    floatingMenu.setAttribute('aria-hidden', 'true');
  }
});

document.addEventListener('click', e => {
  const trg = e.target.closest('.menu-trigger');
  if (!trg) return;
  const filename = trg.dataset.filename;
  const rect = trg.getBoundingClientRect();
  floatingMenu.style.left = (rect.right - 10) + 'px';
  floatingMenu.style.top = (rect.bottom + 8) + 'px';
  floatingMenu.style.display = 'block';
  floatingMenu.setAttribute('aria-hidden', 'false');
  floatingMenu.innerHTML = `
    <button id="fm-download">Download</button>
    <button id="fm-delete">Delete</button>
  `;
  
  // Fix download button to download without redirecting
  document.getElementById('fm-download').onclick = () => {
    // Create a hidden anchor element to trigger download
    const a = document.createElement('a');
    a.href = '/Uploads/' + encodeURIComponent(filename);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    floatingMenu.style.display = 'none';
  };
  
  document.getElementById('fm-delete').onclick = () => {
    currentDeleteFilename = filename;
    deleteModalTitle.textContent = `Delete "${filename}"?`;
    deleteModal.style.display = 'flex';
    floatingMenu.style.display = 'none';
  };
  e.stopPropagation();
});

// ---------- DELETE MODAL ----------
if (deleteCancelBtn) {
  deleteCancelBtn.addEventListener('click', () => {
    deleteModal.style.display = 'none';
    currentDeleteFilename = null;
  });
}

if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener('click', async () => {
    if (!currentDeleteFilename) return;
    try {
      const res = await fetch('/delete/' + encodeURIComponent(currentDeleteFilename), {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      const json = await res.json();
      if (json.success) {
        removeFileFromList(currentDeleteFilename);
      } else {
        alert('Delete error: ' + (json.error || 'Unknown'));
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Network error while deleting');
    }
    deleteModal.style.display = 'none';
    currentDeleteFilename = null;
  });
}

// Close modal on overlay click
if (deleteModal) {
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      deleteModal.style.display = 'none';
      currentDeleteFilename = null;
    }
  });
}

// ---------- SSE ----------
function setupEventSource() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/events', { withCredentials: true });
  eventSource.onmessage = e => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'init') {
        fileList.innerHTML = '';
        data.files.forEach(f => addFileToList(f));
        updateStats();
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
    console.error('SSE connection error');
    eventSource.close();
  };
}

// ---------- LOGOUT ----------
if (logoutBtn) logoutBtn.addEventListener('click', () => {
  if (eventSource) eventSource.close();
  window.location.href = '/logout';
});