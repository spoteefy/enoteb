// Common utilities
const API_URL = '';

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return;
    }

    return response.json();
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html') && !window.location.pathname.includes('index.html')) {
        window.location.href = 'login.html';
    }
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN');
}

function getUserInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Update user info if present
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.full_name) {
        const nameElems = document.querySelectorAll('#userName, #sideName');
        nameElems.forEach(el => el.textContent = user.full_name);

        const avatarElems = document.querySelectorAll('#userAvatar, #sideAvatar, #headerAvatar');
        avatarElems.forEach(el => {
            if (user.avatar) el.src = user.avatar;
            else {
                // Could replace with initials or keep placeholder
            }
        });

        const initialElems = document.querySelectorAll('.user-initials');
        initialElems.forEach(el => el.textContent = getUserInitials(user.full_name));
    }
});
