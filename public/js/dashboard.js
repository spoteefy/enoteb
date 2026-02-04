// Dashboard & Drive Logic
document.addEventListener('DOMContentLoaded', async () => {
    const driveTab = document.getElementById('driveTab');
    const notebooksTab = document.getElementById('notebooksTab');
    const driveSection = document.getElementById('driveSection');
    const notebooksSection = document.getElementById('notebooksSection');
    const driveContent = document.getElementById('driveContent');
    const notebooksGrid = document.getElementById('notebooksGrid');
    const multiSelectBar = document.getElementById('multiSelectBar');
    const selectedCount = document.getElementById('selectedCount');
    const quickCreateModal = document.getElementById('quickCreateModal');

    let categories = [];
    let sources = [];
    let notebooks = [];
    let selectedSources = new Set();

    async function loadData() {
        categories = await apiRequest('/categories');
        sources = await apiRequest('/sources');
        notebooks = await apiRequest('/notebooks');
        renderDrive();
        renderNotebooks();
    }

    function renderDrive() {
        driveContent.innerHTML = '';
        const grouped = {};
        categories.forEach(c => grouped[c.id] = { name: c.name, items: [] });
        grouped[null] = { name: 'Chưa phân loại', items: [] };
        sources.forEach(s => {
            if (grouped[s.category_id]) grouped[s.category_id].items.push(s);
            else grouped[null].items.push(s);
        });

        Object.keys(grouped).forEach(catId => {
            const group = grouped[catId];
            if (group.items.length === 0 && catId === 'null') return;
            const section = document.createElement('div');
            section.className = 'space-y-4';
            section.innerHTML = `
                <div class="flex items-center justify-between text-slate-500 font-bold uppercase text-xs tracking-widest px-2">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">folder</span>
                        ${group.name}
                    </div>
                    ${catId !== 'null' ? `<button class="hover:text-red-400 delete-cat" data-id="${catId}"><span class="material-symbols-outlined text-xs">delete</span></button>` : ''}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
            `;
            const grid = section.querySelector('div:last-child');
            group.items.forEach(s => {
                const card = document.createElement('div');
                const isSelected = selectedSources.has(s.id);
                card.className = `flex items-center justify-between p-4 bg-white dark:bg-slate-800 border ${isSelected ? 'border-primary' : 'border-slate-200 dark:border-slate-700'} rounded-xl hover:shadow-md transition-all cursor-pointer group`;
                card.innerHTML = `
                    <div class="flex items-center gap-3">
                        <input type="checkbox" class="source-checkbox" ${isSelected ? 'checked' : ''}>
                        <div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500"><span class="material-symbols-outlined">description</span></div>
                        <div><p class="text-sm font-bold truncate max-w-[150px]">${s.name}</p></div>
                    </div>
                `;
                card.onclick = (e) => { if(!e.target.closest('input')) toggleSelectSource(s.id); };
                card.querySelector('input').onchange = () => toggleSelectSource(s.id);
                grid.appendChild(card);
            });
            if (section.querySelector('.delete-cat')) {
                section.querySelector('.delete-cat').onclick = async () => {
                    if (confirm('Xóa danh mục này?')) { await apiRequest(`/categories/${catId}`, { method: 'DELETE' }); loadData(); }
                };
            }
            driveContent.appendChild(section);
        });
    }

    function renderNotebooks() {
        notebooksGrid.innerHTML = '';
        notebooks.forEach(nb => {
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:shadow-xl cursor-pointer';
            card.innerHTML = `<h3 class="text-lg font-bold">${nb.name}</h3><p class="text-sm text-slate-500">${nb.description || ''}</p>`;
            card.onclick = () => window.location.href = `notebook.html?id=${nb.id}`;
            notebooksGrid.appendChild(card);
        });
    }

    function toggleSelectSource(id) {
        if (selectedSources.has(id)) selectedSources.delete(id);
        else selectedSources.add(id);
        updateMultiSelectBar();
        renderDrive();
    }

    function updateMultiSelectBar() {
        if (selectedSources.size > 0) { multiSelectBar.classList.remove('hidden'); selectedCount.textContent = selectedSources.size; }
        else multiSelectBar.classList.add('hidden');
    }

    driveTab.onclick = () => { driveSection.classList.remove('hidden'); notebooksSection.classList.add('hidden'); driveTab.classList.add('active-glass-item'); notebooksTab.classList.remove('active-glass-item'); };
    notebooksTab.onclick = () => { notebooksSection.classList.remove('hidden'); driveSection.classList.add('hidden'); notebooksTab.classList.add('active-glass-item'); driveTab.classList.remove('active-glass-item'); };

    document.getElementById('createNotebookBtn').onclick = () => quickCreateModal.classList.remove('hidden');
    document.getElementById('closeQuickCreate').onclick = () => quickCreateModal.classList.add('hidden');

    document.getElementById('confirmQuickCreate').onclick = async () => {
        const name = document.getElementById('newNbName').value;
        const description = document.getElementById('newNbDesc').value;
        const sourceIds = Array.from(selectedSources);
        if (name) {
            const nb = await apiRequest('/notebooks', { method: 'POST', body: JSON.stringify({ name, description, sourceIds }) });
            window.location.href = `notebook.html?id=${nb.id}`;
        }
    };

    document.getElementById('multiAddToNotebook').onclick = () => quickCreateModal.classList.remove('hidden');

    document.getElementById('multiQuickAnalysis').onclick = async () => {
        const sourceIds = Array.from(selectedSources);
        try {
            const data = await apiRequest('/ai/fast-analysis', { method: 'POST', body: JSON.stringify({ sourceIds }) });
            localStorage.setItem('selectedSources', JSON.stringify(sourceIds));
            window.location.href = 'analysis.html';
        } catch (e) {
            alert('Analysis failed');
        }
    };

    document.getElementById('clearSelection').onclick = () => { selectedSources.clear(); updateMultiSelectBar(); renderDrive(); };

    // Modals
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationModal = document.getElementById('notificationModal');
    const closeNotifications = document.getElementById('closeNotifications');

    notificationBtn.onclick = () => notificationModal.classList.toggle('hidden');
    closeNotifications.onclick = () => notificationModal.classList.add('hidden');

    const uploadBtn = document.getElementById('uploadBtn');
    const uploadProgressModal = document.getElementById('uploadProgressModal');
    const closeUploadProgress = document.getElementById('closeUploadProgress');

    uploadBtn.onclick = () => {
        uploadProgressModal.classList.remove('hidden');
        // Simulate upload
        setTimeout(() => {
            uploadProgressModal.classList.add('hidden');
            loadData();
        }, 3000);
    };
    closeUploadProgress.onclick = () => uploadProgressModal.classList.add('hidden');

    document.getElementById('createCategoryBtn').onclick = async () => {
        const name = prompt('Tên danh mục:');
        if (name) { await apiRequest('/categories', { method: 'POST', body: JSON.stringify({ name }) }); loadData(); }
    };

    loadData();
});
