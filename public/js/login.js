// ============================================================
// login.js — Admin login handler
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect to admin
  if (getToken()) {
    fetch('/api/auth/me', { headers: authHeaders() })
      .then(r => { if (r.ok) window.location.href = '/admin'; })
      .catch(() => {});
  }

  const form = document.getElementById('loginForm');
  const errorDiv = document.getElementById('loginError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      errorDiv.textContent = 'Vui lòng nhập đầy đủ thông tin';
      errorDiv.style.display = 'block';
      return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Đang đăng nhập...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok) {
        setToken(data.token);
        window.location.href = '/admin';
      } else {
        errorDiv.textContent = data.error || 'Đăng nhập thất bại';
        errorDiv.style.display = 'block';
      }
    } catch (err) {
      errorDiv.textContent = 'Lỗi kết nối server';
      errorDiv.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  });
});
