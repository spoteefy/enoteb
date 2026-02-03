document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.querySelectorAll('.user-name').forEach(el => {
            if (user.full_name) {
                const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                el.textContent = initials;
            } else {
                el.textContent = '??';
            }
        });
    }

    fetchNotebooks();

    const createNotebookBtn = document.querySelector('#create-notebook-btn');
    const notificationBtn = document.querySelector('button .material-symbols-outlined[textContent="notifications"]')?.parentElement;

    if (notificationBtn) {
        notificationBtn.onclick = () => toggleModal('notification-modal');
    }

    if (createNotebookBtn) {
        createNotebookBtn.onclick = () => {
            toggleModal('create-modal');
        };
    }

    const modalForm = document.querySelector('#modal-create-form');
    if (modalForm) {
        modalForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.querySelector('#modal-nb-name').value;
            const description = document.querySelector('#modal-nb-desc').value;
            const icon = document.querySelector('#icon-picker').textContent.trim();

            const res = await fetch('/api/notebooks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, description, icon })
            });
            const data = await res.json();
            toggleModal('create-modal');
            window.location.href = `/notebook.html?id=${data.id}`;
        };
    }
});

window.toggleModal = function(id) {
    const modal = document.getElementById(id);
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } else {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

async function fetchNotebooks() {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/notebooks', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const notebooks = await res.json();
    const container = document.querySelector('#notebooks-container');
    if (!container) return;

    // Preserve the "Create New" button
    const createBtnHtml = container.querySelector('button').outerHTML;
    container.innerHTML = createBtnHtml;
    // Reload createBtn reference since innerHTML was overwritten
    const newCreateBtn = container.querySelector('#create-notebook-btn');
    if (newCreateBtn) {
        newCreateBtn.onclick = () => toggleModal('create-modal');
    }

    notebooks.forEach(nb => {
        const card = document.createElement('div');
        card.className = "notebook-card group bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl p-6 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 flex flex-col justify-between relative cursor-pointer";
        card.onclick = () => window.location.href = `/notebook.html?id=${nb.id}`;
        card.innerHTML = `
            <div class="absolute top-4 right-4 opacity-0 action-btn transition-opacity">
                <button class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <span class="material-symbols-outlined text-slate-400">more_vert</span>
                </button>
            </div>
            <div>
                <div class="w-12 h-12 flex items-center justify-center text-3xl mb-4 bg-orange-100 dark:bg-orange-500/10 rounded-xl">
                    ${nb.icon || '💡'}
                </div>
                <h3 class="text-lg font-bold mb-2 group-hover:text-primary transition-colors">${nb.name}</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-6">${nb.description || 'Chưa có mô tả'}</p>
            </div>
            <div class="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">source</span>
                    <span>0 nguồn</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">description</span>
                    <span>0 ghi chú</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}
