// Trash Logic
document.addEventListener('DOMContentLoaded', async () => {
    const trashTableBody = document.getElementById('trashTableBody');
    const trashCount = document.getElementById('trashCount');
    const emptyTrashState = document.getElementById('emptyTrashState');
    const restoreAllBtn = document.getElementById('restoreAllBtn');
    const emptyTrashBtn = document.getElementById('emptyTrashBtn');

    let trashItems = [];

    async function loadTrash() {
        trashItems = await apiRequest('/trash');
        renderTrash();
    }

    function renderTrash() {
        trashCount.textContent = `${trashItems.length} mục`;
        trashTableBody.innerHTML = '';

        if (trashItems.length === 0) {
            emptyTrashState.classList.remove('hidden');
        } else {
            emptyTrashState.classList.add('hidden');
        }

        trashItems.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'item-row hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group';

            let icon = 'description';
            let color = 'text-blue-500';
            if (item.item_type === 'notebook') { icon = 'folder'; color = 'text-amber-500'; }
            if (item.item_type === 'note') { icon = 'text_snippet'; color = 'text-slate-400'; }

            row.innerHTML = `
                <td class="px-6 py-5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <span class="material-symbols-outlined ${color} text-lg">${icon}</span>
                        </div>
                        <span class="text-sm font-semibold tracking-tight">${item.item_type.toUpperCase()}: ${item.item_id}</span>
                    </div>
                </td>
                <td class="px-6 py-5 text-sm text-slate-500 font-medium">${new Date(item.deleted_at).toLocaleString()}</td>
                <td class="px-6 py-5">
                    <span class="text-xs font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Còn 30 ngày</span>
                </td>
                <td class="px-6 py-5 text-right">
                    <div class="action-buttons opacity-0 flex items-center justify-end gap-1 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                        <button class="p-2 hover:bg-primary hover:text-white text-primary rounded-xl transition-all restore-btn" title="Khôi phục" data-id="${item.id}">
                            <span class="material-symbols-outlined text-xl">restore_from_trash</span>
                        </button>
                        <button class="p-2 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-all delete-perm-btn" title="Xóa vĩnh viễn" data-id="${item.id}">
                            <span class="material-symbols-outlined text-xl">delete_forever</span>
                        </button>
                    </div>
                </td>
            `;

            row.querySelector('.restore-btn').addEventListener('click', async () => {
                await apiRequest(`/trash/${item.id}/restore`, { method: 'POST' });
                loadTrash();
            });

            row.querySelector('.delete-perm-btn').addEventListener('click', async () => {
                if (confirm('Xóa vĩnh viễn mục này?')) {
                    await apiRequest(`/trash/${item.id}`, { method: 'DELETE' });
                    loadTrash();
                }
            });

            trashTableBody.appendChild(row);
        });
    }

    restoreAllBtn.addEventListener('click', async () => {
        for (const item of trashItems) {
            await apiRequest(`/trash/${item.id}/restore`, { method: 'POST' });
        }
        loadTrash();
    });

    emptyTrashBtn.addEventListener('click', async () => {
        if (confirm('Dọn sạch thùng rác?')) {
            for (const item of trashItems) {
                await apiRequest(`/trash/${item.id}`, { method: 'DELETE' });
            }
            loadTrash();
        }
    });

    loadTrash();
});
