document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const settingsContent = document.getElementById('settingsContent');
    const settingsNav = document.getElementById('settingsNav');
    const sideName = document.getElementById('sideName');
    const sideAvatar = document.getElementById('sideAvatar');
    const logoutBtn = document.getElementById('logoutBtn');

    async function loadUser() {
        try {
            const res = await fetch('/api/user', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const user = await res.json();
            sideName.textContent = user.full_name;
            if (user.avatar_url) sideAvatar.src = user.avatar_url;
            return user;
        } catch (err) {
            console.error(err);
        }
    }

    const user = await loadUser();

    async function renderSessions() {
        settingsContent.innerHTML = `
            <div class="max-w-4xl mx-auto px-6 py-12 lg:px-12">
                <header class="mb-10">
                    <h1 class="text-3xl font-bold mb-2">Quản lý Thiết bị & Phiên đăng nhập</h1>
                    <p class="text-slate-400">Xem và quản lý các thiết bị hiện đang truy cập vào tài khoản.</p>
                </header>
                <div id="sessionsList" class="space-y-4">
                    <p class="text-slate-500">Đang tải danh sách phiên...</p>
                </div>
            </div>
        `;
        const list = document.getElementById('sessionsList');
        try {
            const res = await fetch('/api/sessions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const sessions = await res.json();
            list.innerHTML = '';
            sessions.forEach((s, i) => {
                const isCurrent = i === 0; // First is current
                const div = document.createElement('div');
                div.className = "bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between";
                div.innerHTML = `
                    <div class="flex items-center gap-5">
                        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <span class="material-symbols-outlined text-3xl">${s.device_name.includes('Phone') ? 'smartphone' : 'desktop_windows'}</span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-lg">${s.device_name} ${isCurrent ? '(Thiết bị này)' : ''}</h3>
                                ${isCurrent ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">Đang hoạt động</span>' : ''}
                            </div>
                            <p class="text-slate-500 dark:text-slate-400 text-sm">${s.location} • ${new Date(s.last_active).toLocaleString()}</p>
                        </div>
                    </div>
                    ${!isCurrent ? `<button class="text-red-500 text-sm font-bold hover:underline" data-id="${s.id}" onclick="terminateSession(${s.id})">Đăng xuất</button>` : ''}
                `;
                list.appendChild(div);
            });
        } catch (e) {
            list.innerHTML = '<p class="text-red-500">Lỗi khi tải danh sách phiên.</p>';
        }
    }

    window.terminateSession = async (id) => {
        if (confirm('Bạn có muốn đăng xuất thiết bị này không?')) {
            await fetch(`/api/sessions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            renderSessions();
        }
    };

    function renderTab(tab) {
        // Update nav UI
        settingsNav.querySelectorAll('button').forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('nav-item-active');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('nav-item-active');
                btn.classList.add('text-slate-400');
            }
        });

        if (tab === 'profile') {
            settingsContent.innerHTML = `
                <div class="max-w-4xl mx-auto px-6 py-12 lg:px-12">
                    <header class="mb-10">
                        <h1 class="text-3xl font-bold mb-2">Cài đặt Hồ sơ</h1>
                        <p class="text-slate-400">Quản lý thông tin cá nhân và cách bạn xuất hiện trên Kho Tri Thức.</p>
                    </header>
                    <div class="space-y-8">
                        <section class="bg-panel-dark/40 border border-white/5 rounded-2xl p-8">
                            <div class="flex items-center gap-8">
                                <div class="relative group">
                                    <img alt="Avatar" id="profileAvatar" class="w-24 h-24 rounded-2xl object-cover border-2 border-primary/20" src="${user.avatar_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAt3zfpdCz3mxegoOm1bW4TiQXOPxsBemRIkjpuTnjl9BFXPCZMTs-aTPTfH9gKbYJ_KeynC-HkS_Ql3LdqPuIMpt64hK6tipB3uWMdKO0QMVO7BitK_pUnFqw42T9KUnyUkpcu3hEtoJWeekCh_cGSxvKVzMKrJHoidpaWtGFGSt1auuTnStREVmd8ohHkEkq_9Ts2EGzdNYltkkPk9vN1WPqENBvLVfMC_OBKpfG9BwCv_OkxhchAa92uvkJDq-XiZ0eyAqAaqVKT'}"/>
                                    <button class="absolute -bottom-2 -right-2 bg-primary p-2 rounded-lg shadow-lg hover:scale-105 transition-transform">
                                        <span class="material-symbols-outlined text-white text-sm">edit</span>
                                    </button>
                                </div>
                                <div class="flex-1">
                                    <h3 class="text-lg font-semibold mb-1">Ảnh đại diện</h3>
                                    <p class="text-sm text-slate-400 mb-4">Hỗ trợ JPG, PNG hoặc GIF. Tối đa 2MB.</p>
                                    <div class="flex gap-3">
                                        <button class="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">Tải ảnh mới</button>
                                        <button class="px-4 py-2 border border-slate-700 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">Xóa ảnh</button>
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section class="bg-panel-dark/40 border border-white/5 rounded-2xl p-8">
                            <h3 class="text-lg font-semibold mb-6">Thông tin cá nhân</h3>
                            <form id="profileForm" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="md:col-span-2">
                                    <label class="block text-sm font-medium text-slate-400 mb-2">Họ và tên</label>
                                    <input id="full-name" class="w-full bg-background-dark border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-white" type="text" value="${user.full_name}"/>
                                </div>
                                <div class="md:col-span-2">
                                    <label class="block text-sm font-medium text-slate-400 mb-2">Email</label>
                                    <div class="relative">
                                        <input class="w-full bg-background-dark border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-white" type="email" value="${user.email}" readonly/>
                                        <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-500 rounded-full">
                                            <span class="material-symbols-outlined text-[14px] font-bold">verified</span>
                                            <span class="text-[10px] font-bold uppercase tracking-wider">Đã xác minh</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="md:col-span-2 pt-4 flex justify-end gap-3">
                                    <button class="px-8 py-2.5 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all" type="submit">Lưu thay đổi</button>
                                </div>
                            </form>
                        </section>
                    </div>
                </div>
            `;
        } else if (tab === 'security') {
             settingsContent.innerHTML = `
                <div class="max-w-4xl mx-auto px-6 py-12 lg:px-12">
                    <header class="mb-10">
                        <h1 class="text-3xl font-bold mb-2">Bảo mật</h1>
                        <p class="text-slate-400">Bảo vệ tài khoản và dữ liệu tri thức của bạn.</p>
                    </header>
                    <div class="space-y-8">
                         <section class="bg-panel-dark/40 border border-white/5 rounded-2xl p-8">
                            <div class="flex justify-between items-start mb-6">
                                <div>
                                    <h3 class="text-lg font-semibold">Bảo mật tài khoản</h3>
                                    <p class="text-sm text-slate-400">Quản lý mật khẩu và các phương thức xác thực.</p>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <div class="flex items-center justify-between p-4 bg-background-dark/50 border border-slate-700 rounded-xl">
                                    <div class="flex items-center gap-4">
                                        <div class="p-2 bg-slate-800 rounded-lg text-slate-400">
                                            <span class="material-symbols-outlined">lock</span>
                                        </div>
                                        <div>
                                            <p class="font-medium">Mật khẩu</p>
                                            <p class="text-xs text-slate-500">Đã thay đổi 3 tháng trước</p>
                                        </div>
                                    </div>
                                    <button class="text-primary text-sm font-bold hover:underline">Đổi mật khẩu</button>
                                </div>
                                <div class="flex items-center justify-between p-4 bg-background-dark/50 border border-slate-700 rounded-xl">
                                    <div class="flex items-center gap-4">
                                        <div class="p-2 bg-slate-800 rounded-lg text-slate-400">
                                            <span class="material-symbols-outlined">key</span>
                                        </div>
                                        <div>
                                            <p class="font-medium">Xác thực 2 yếu tố (2FA)</p>
                                            <p class="text-xs text-slate-500">Thêm một lớp bảo mật cho tài khoản của bạn</p>
                                        </div>
                                    </div>
                                    <button class="px-4 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors">Thiết lập</button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
             `;
        } else if (tab === 'sessions') {
            renderSessions();
        }
    }

    settingsNav.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-tab]');
        if (btn) {
            renderTab(btn.dataset.tab);
        }
    });

    logoutBtn.onclick = () => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    };

    renderTab('profile');
});
