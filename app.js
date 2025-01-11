// OSTUXY - Secure Offline File Sharing
// Version 3.0

// Utility functions
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const compressData = async (data) => {
    const compressed = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(pako.deflate(e.target.result));
        reader.readAsArrayBuffer(new Blob([data]));
    });
    return compressed;
};
const decompressData = async (compressedData) => {
    const decompressed = pako.inflate(compressedData);
    return new Blob([decompressed]);
};
const encryptData = (data, key) => CryptoJS.AES.encrypt(data, key).toString();
const decryptData = (encryptedData, key) => CryptoJS.AES.decrypt(encryptedData, key).toString(CryptoJS.enc.Utf8);

// DOM Elements
const app = document.getElementById('app');
const mainContent = document.getElementById('mainContent');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const toast = document.getElementById('toast');

// Global variables
let currentView = 'share';
let settings = {
    theme: 'light',
    accentColor: 'blue',
    codeLength: 6,
    maxFileSize: 100, // MB
    autoDeleteDays: 30,
    defaultEncryption: 'medium',
    requirePassword: false
};

// Event Listeners
document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(e.currentTarget.getAttribute('href').substring(1));
    });
});

// Initialize the app
function initApp() {
    loadSettings();
    switchView('share');
    setupPullToRefresh();
}

// Switch between different views
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(view).classList.add('active');
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('href') === `#${view}`);
    });

    switch (view) {
        case 'share':
            setupShareView();
            break;
        case 'receive':
            setupReceiveView();
            break;
        case 'history':
            setupHistoryView();
            break;
        case 'settings':
            setupSettingsView();
            break;
    }
}

// Setup Share View
function setupShareView() {
    const fileInput = document.getElementById('fileInput');
    const shareFileBtn = document.getElementById('shareFileBtn');
    const filePreview = document.getElementById('filePreview');
    const shareProgress = document.getElementById('shareProgress');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > settings.maxFileSize * 1024 * 1024) {
                showToast(`File size exceeds the maximum limit of ${settings.maxFileSize}MB.`, 'error');
                fileInput.value = '';
                return;
            }
            showFilePreview(file, filePreview);
        }
    });

    shareFileBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (file) {
            shareFile(file, shareProgress);
        } else {
            showToast('Please select a file to share.', 'error');
        }
    });
}

// Setup Receive View
function setupReceiveView() {
    const codeInput = document.getElementById('codeInput');
    const receiveFileBtn = document.getElementById('receiveFileBtn');
    const receiveProgress = document.getElementById('receiveProgress');

    receiveFileBtn.addEventListener('click', () => {
        const code = codeInput.value.trim().toUpperCase();
        if (code.length === settings.codeLength) {
            receiveFile(code, receiveProgress);
        } else {
            showToast(`Please enter a valid ${settings.codeLength}-digit code.`, 'error');
        }
    });
}

// Setup History View
function setupHistoryView() {
    const historyList = document.getElementById('historyList');
    const historyTypeFilter = document.getElementById('historyTypeFilter');

    const renderHistory = () => {
        const history = getHistory();
        const filteredHistory = history.filter(item => {
            if (historyTypeFilter.value === 'all') return true;
            return item.type === historyTypeFilter.value;
        });

        historyList.innerHTML = '';
        filteredHistory.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML = `
                <div class="history-item-info">
                    <strong>${item.fileName}</strong>
                    <br>
                    <small>${new Date(item.timestamp).toLocaleString()}</small>
                </div>
                <div class="history-item-actions">
                    <button class="ios-button secondary copy-code" data-code="${item.code}">Copy Code</button>
                    ${item.type === 'sent' ? `<button class="ios-button primary download" data-code="${item.code}">Download</button>` : ''}
                </div>
            `;
            historyList.appendChild(li);
        });

        // Add event listeners for copy code and download buttons
        historyList.querySelectorAll('.copy-code').forEach(button => {
            button.addEventListener('click', (e) => {
                const code = e.target.getAttribute('data-code');
                navigator.clipboard.writeText(code).then(() => {
                    showToast('Code copied to clipboard!', 'success');
                });
            });
        });

        historyList.querySelectorAll('.download').forEach(button => {
            button.addEventListener('click', (e) => {
                const code = e.target.getAttribute('data-code');
                downloadFile(code);
            });
        });
    };

    historyTypeFilter.addEventListener('change', renderHistory);
    renderHistory();
}

// Setup Settings View
function setupSettingsView() {
    const themeSelect = document.getElementById('themeSelect');
    const accentColorSelect = document.getElementById('accentColorSelect');
    const codeLengthInput = document.getElementById('codeLengthInput');
    const maxFileSizeInput = document.getElementById('maxFileSizeInput');
    const autoDeleteInput = document.getElementById('autoDeleteInput');
    const defaultEncryptionSelect = document.getElementById('defaultEncryptionSelect');
    const passwordProtectionToggle = document.getElementById('passwordProtectionToggle');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // Populate settings
    themeSelect.value = settings.theme;
    accentColorSelect.value = settings.accentColor;
    codeLengthInput.value = settings.codeLength;
    maxFileSizeInput.value = settings.maxFileSize;
    autoDeleteInput.value = settings.autoDeleteDays;
    defaultEncryptionSelect.value = settings.defaultEncryption;
    passwordProtectionToggle.checked = settings.requirePassword;

    saveSettingsBtn.addEventListener('click', () => {
        settings = {
            theme: themeSelect.value,
            accentColor: accentColorSelect.value,
            codeLength: parseInt(codeLengthInput.value, 10),
            maxFileSize: parseInt(maxFileSizeInput.value, 10),
            autoDeleteDays: parseInt(autoDeleteInput.value, 10),
            defaultEncryption: defaultEncryptionSelect.value,
            requirePassword: passwordProtectionToggle.checked
        };
        saveSettings();
        applySettings();
        showToast('Settings saved successfully!', 'success');
    });
}

// File sharing functionality
async function shareFile(file, progressElement) {
    try {
        showProgress(progressElement, 0);
        const compressedData = await compressData(file);
        showProgress(progressElement, 30);

        const code = generateCode();
        const key = settings.requirePassword ? prompt('Enter a password to encrypt the file:') : code;
        if (settings.requirePassword && !key) {
            showToast('Password is required for encryption.', 'error');
            return;
        }

        const encryptedData = encryptData(compressedData, key);
        showProgress(progressElement, 60);

        // Simulate uploading to a server (in a real app, you'd send this to your backend)
        await new Promise(resolve => setTimeout(resolve, 1000));
        showProgress(progressElement, 90);

        saveSharedFile(file.name, file.type, encryptedData, code, key);
        showProgress(progressElement, 100);

        showToast(`File shared successfully. Your code is: ${code}`, 'success');
        addToHistory('sent', file.name, file.type, code);
    } catch (error) {
        console.error('Error sharing file:', error);
        showToast('An error occurred while sharing the file.', 'error');
    }
}

// Receive file functionality
async function receiveFile(code, progressElement) {
    try {
        showProgress(progressElement, 0);
        const sharedFile = getSharedFile(code);
        if (!sharedFile) {
            showToast('Invalid code or file not found.', 'error');
            return;
        }

        let key = code;
        if (sharedFile.isPasswordProtected) {
            key = prompt('This file is password-protected. Please enter the password:');
            if (!key) {
                showToast('Password is required to access this file.', 'error');
                return;
            }
        }

        showProgress(progressElement, 30);
        const decryptedData = decryptData(sharedFile.data, key);
        showProgress(progressElement, 60);
        const decompressedData = await decompressData(decryptedData);
        showProgress(progressElement, 90);

        // Create a download link
        const url = URL.createObjectURL(new Blob([decompressedData], { type: sharedFile.fileType }));
        const link = document.createElement('a');
        link.href = url;
        link.download = sharedFile.fileName;
        link.click();
        URL.revokeObjectURL(url);

        showProgress(progressElement, 100);
        showToast('File received and downloaded successfully.', 'success');
        addToHistory('received', sharedFile.fileName, sharedFile.fileType, code);
    } catch (error) {
        console.error('Error receiving file:', error);
        showToast('An error occurred while receiving the file.', 'error');
    }
}

// Save shared file to local storage
function saveSharedFile(fileName, fileType, data, code, key) {
    const sharedFiles = JSON.parse(localStorage.getItem('sharedFiles')) || {};
    sharedFiles[code] = {
        fileName,
        fileType,
        data,
        timestamp: Date.now(),
        expirationTime: Date.now() + (settings.autoDeleteDays * 24 * 60 * 60 * 1000),
        isPasswordProtected: settings.requirePassword
    };
    localStorage.setItem('sharedFiles', JSON.stringify(sharedFiles));
}

// Get shared file from local storage
function getSharedFile(code) {
    const sharedFiles = JSON.parse(localStorage.getItem('sharedFiles')) || {};
    return sharedFiles[code];
}

// Add file transfer to history
function addToHistory(type, fileName, fileType, code) {
    const history = getHistory();
    history.unshift({ type, fileName, fileType, code, timestamp: Date.now() });
    localStorage.setItem('transferHistory', JSON.stringify(history));
}

// Get transfer history
function getHistory() {
    return JSON.parse(localStorage.getItem('transferHistory')) || [];
}

// Load settings from local storage
function loadSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('settings'));
    if (savedSettings) {
        settings = { ...settings, ...savedSettings };
    }
    applySettings();
}

// Save settings to local storage
function saveSettings() {
    localStorage.setItem('settings', JSON.stringify(settings));
}

// Apply settings
function applySettings() {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(`${settings.theme}-theme`);
    document.documentElement.style.setProperty('--primary-color', `var(--${settings.accentColor})`);
}

// Show file preview
function showFilePreview(file, previewElement) {
    previewElement.innerHTML = '';
    if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => URL.revokeObjectURL(img.src);
        img.style.maxWidth = '100%';
        img.style.maxHeight = '200px';
        previewElement.appendChild(img);
    } else {
        previewElement.textContent = `File: ${file.name} (${formatFileSize(file.size)})`;
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show progress
function showProgress(element, percent) {
    element.style.display = 'block';
    element.querySelector('.progress').style.width = `${percent}%`;
    element.querySelector('.progress-text').textContent = `${percent}%`;
    if (percent === 100) {
        setTimeout(() => {
            element.style.display = 'none';
        }, 1000);
    }
}

// Show toast notification
function showHere's the continuation of the text stream from the cut-off point:

none';
        }, 1000);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Setup pull-to-refresh
function setupPullToRefresh() {
    const pullToRefresh = document.createElement('div');
    pullToRefresh.className = 'pull-to-refresh';
    pullToRefresh.innerHTML = '<div class="pull-to-refresh-icon"></div>';
    mainContent.insertBefore(pullToRefresh, mainContent.firstChild);

    let startY;
    let currentY;
    let refreshing = false;

    mainContent.addEventListener('touchstart', (e) => {
        startY = e.touches[0].pageY;
    });

    mainContent.addEventListener('touchmove', (e) => {
        if (refreshing) return;
        currentY = e.touches[0].pageY;
        const diff = currentY - startY;
        if (diff > 0 && mainContent.scrollTop === 0) {
            pullToRefresh.style.transform = `translateY(${Math.min(diff / 2, 60)}px)`;
        }
    });

    mainContent.addEventListener('touchend', () => {
        if (refreshing) return;
        if (currentY - startY > 60) {
            refreshContent();
        } else {
            pullToRefresh.style.transform = 'translateY(0)';
        }
    });

    function refreshContent() {
        refreshing = true;
        pullToRefresh.style.transform = 'translateY(60px)';
        // Simulate content refresh
        setTimeout(() => {
            refreshing = false;
            pullToRefresh.style.transform = 'translateY(0)';
            showToast('Content refreshed', 'success');
        }, 1500);
    }
}

// Auto-delete old shared files
function autoDeleteOldFiles() {
    const sharedFiles = JSON.parse(localStorage.getItem('sharedFiles')) || {};
    const now = Date.now();
    let deleted = 0;

    for (const code in sharedFiles) {
        const file = sharedFiles[code];
        if (now > file.expirationTime) {
            delete sharedFiles[code];
            deleted++;
        }
    }

    localStorage.setItem('sharedFiles', JSON.stringify(sharedFiles));
    console.log(`Auto-deleted ${deleted} expired shared files.`);
}

// Run auto-delete every day
setInterval(autoDeleteOldFiles, 24 * 60 * 60 * 1000);

// Initialize the app
initApp();

