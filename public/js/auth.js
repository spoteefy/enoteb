document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('form#login-form');
    const registerForm = document.querySelector('form#register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('input[type="email"]').value;
            const password = loginForm.querySelector('input[type="password"]').value;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = '/dashboard.html';
                } else {
                    alert(data.error || 'Login failed');
                }
            } catch (err) {
                alert('An error occurred');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const full_name = registerForm.querySelector('input[placeholder*="họ và tên"]').value;
            const email = registerForm.querySelector('input[type="email"]').value;
            const password = registerForm.querySelectorAll('input[type="password"]')[0].value;
            const confirmPassword = registerForm.querySelectorAll('input[type="password"]')[1].value;

            if (password !== confirmPassword) {
                alert('Mật khẩu không khớp');
                return;
            }

            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, full_name })
                });
                const data = await res.json();
                if (res.ok) {
                    alert('Đăng ký thành công! Vui lòng đăng nhập.');
                    window.location.href = '/login.html';
                } else {
                    alert(data.error || 'Registration failed');
                }
            } catch (err) {
                alert('An error occurred');
            }
        });
    }
});
