const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');
const loginSection = document.getElementById('login-section');
const uploadMainContainer = document.getElementById('upload-main-container');
const logoutSection = document.getElementById('logout-section');
const dropZone = document.getElementById('drop-zone');
const fileList = document.getElementById('file-list');
const fileInput = document.getElementById('file-input');
const selectFileBtn = document.getElementById('select-file-btn');

// ---------- LOGIN ----------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(loginForm);
  const res = await fetch('/login', { method: 'POST', body: formData });

  if (res.redirected) {
    loginSection.style.display = 'none';
    uploadMainContainer.style.display = 'flex';
    logoutSection.style.display = 'flex';
    const username = loginForm.elements['username'].value;
    document.getElementById('greeting').innerHTML =
        `<span class="greeting-word">Hello,</span> <span class="username">${username}</span>`;
  } else {
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const error = doc.getElementById('error-message');
    errorMessage.innerText = error ? error.innerText : 'Login failed';
  }
});

// ---------- FILE UPLOAD ----------
async function uploadFiles(files) {
  for (let file of files) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    addFileToList(data);
  }
  alert('Files uploaded successfully');
}

// Drag & Drop
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', async e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  await uploadFiles(e.dataTransfer.files);
});

// Upload via button
selectFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  await uploadFiles(fileInput.files);
  fileInput.value = '';
});

// ---------- ADD FILE TO LIST ----------
function addFileToList(data) {
  let existingLi = Array.from(fileList.children).find(
    li => li.querySelector('a').textContent === data.filename
  );
  if (existingLi) {
    existingLi.querySelector('.file-date').textContent = data.upload_time;
  } else {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'space-between';
    li.style.alignItems = 'center';

    const link = document.createElement('a');
    link.textContent = data.filename;
    link.href = '/uploads/' + encodeURIComponent(data.filename);
    link.target = '_blank';

    const rightSide = document.createElement('div');
    rightSide.style.display = 'flex';
    rightSide.style.alignItems = 'center';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = data.upload_time;
    timeSpan.classList.add('file-date');
    timeSpan.style.marginRight = '25px';

    const optionsWrapper = document.createElement('div');
    optionsWrapper.classList.add('file-options');

    const menuIcon = document.createElement('span');
    menuIcon.classList.add('menu-trigger');
    menuIcon.textContent = '⋮';
    menuIcon.style.cursor = 'pointer';

    const optionsMenu = document.createElement('div');
    optionsMenu.classList.add('options-menu');

    const downloadBtn = document.createElement('button');
    downloadBtn.classList.add('download-btn');
    downloadBtn.dataset.filename = data.filename;
    downloadBtn.textContent = 'Download';
    optionsMenu.appendChild(downloadBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-btn');
    deleteBtn.dataset.filename = data.filename;
    deleteBtn.textContent = 'Delete';
    optionsMenu.appendChild(deleteBtn);

    optionsWrapper.appendChild(menuIcon);
    optionsWrapper.appendChild(optionsMenu);

    rightSide.appendChild(timeSpan);
    rightSide.appendChild(optionsWrapper);

    li.appendChild(link);
    li.appendChild(rightSide);
    fileList.appendChild(li);
  }
}

// ---------- EVENT DELEGATION FOR OPTIONS & DELETE ----------
fileList.addEventListener('click', (e) => {
  // Toggle options menu
  if (e.target.classList.contains('menu-trigger')) {
    const optionsMenu = e.target.nextElementSibling;
    const isVisible = optionsMenu.style.display === 'block';
    document.querySelectorAll('.options-menu').forEach(m => m.style.display = 'none');
    optionsMenu.style.display = isVisible ? 'none' : 'block';
  }

  // Download file
  if (e.target.classList.contains('download-btn')) {
    const filename = e.target.dataset.filename;
    window.location.href = '/uploads/' + encodeURIComponent(filename);
  }

  // Delete file
  if (e.target.classList.contains('delete-btn')) {
    const li = e.target.closest('li');
    const filename = e.target.dataset.filename;
    fetch('/delete/' + encodeURIComponent(filename), { method: 'DELETE' })
      .then(res => res.json())
      .then(result => {
        if (result.success) li.remove();
        else alert('Error deleting file: ' + result.error);
      });
  }
});

// ---------- LOGOUT ----------
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    window.location.href = '/logout';
  });
}
