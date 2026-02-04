document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const sourceTableBody = document.getElementById('sourceTableBody');
    const selectedCount = document.getElementById('selectedCount');
    const createForm = document.getElementById('createForm');
    const sourceSearch = document.getElementById('sourceSearch');

    let allSources = [];
    let selectedSourceIds = new Set();

    async function loadSources() {
        try {
            const res = await fetch('/api/sources', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            allSources = await res.json();
            renderSources(allSources);
        } catch (err) {
            console.error('Failed to load sources', err);
        }
    }

    function renderSources(sources) {
        sourceTableBody.innerHTML = '';
        sources.forEach(source => {
            const tr = document.createElement('tr');
            tr.className = 'group hover:bg-primary/[0.02] transition-colors cursor-pointer';

            const format = source.filename ? source.filename.split('.').pop().toUpperCase() : 'NOTE';
            const icon = format === 'PDF' ? 'picture_as_pdf' : (format === 'DOCX' ? 'description' : 'article');
            const iconColor = format === 'PDF' ? 'text-red-400' : (format === 'DOCX' ? 'text-blue-400' : 'text-green-400');
            const bgColor = format === 'PDF' ? 'bg-red-500/10' : (format === 'DOCX' ? 'bg-blue-500/10' : 'bg-green-500/10');

            tr.innerHTML = `
                <td class="px-6 py-4 text-center">
                    <input type="checkbox" class="source-checkbox w-3.5 h-3.5 rounded border-white/10 bg-transparent text-primary focus:ring-offset-0 focus:ring-primary/20" value="${source.id}" ${selectedSourceIds.has(source.id) ? 'checked' : ''}>
                </td>
                <td class="px-4 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center ${iconColor}">
                            <span class="material-symbols-outlined text-lg">${icon}</span>
                        </div>
                        <span class="text-slate-200 font-medium group-hover:text-white transition-colors">${source.title || source.filename}</span>
                    </div>
                </td>
                <td class="px-4 py-4 text-slate-500 text-center">${format}</td>
                <td class="px-6 py-4 text-slate-500 text-right">${new Date(source.created_at).toLocaleDateString()}</td>
            `;

            tr.onclick = (e) => {
                if (e.target.tagName !== 'INPUT') {
                    const cb = tr.querySelector('input');
                    cb.checked = !cb.checked;
                    toggleSource(source.id, cb.checked);
                }
            };

            const cb = tr.querySelector('input');
            cb.onchange = () => toggleSource(source.id, cb.checked);

            sourceTableBody.appendChild(tr);
        });
        updateSelectedCount();
    }

    function toggleSource(id, checked) {
        if (checked) selectedSourceIds.add(id);
        else selectedSourceIds.delete(id);
        updateSelectedCount();
    }

    function updateSelectedCount() {
        selectedCount.textContent = `Đã chọn ${selectedSourceIds.size} / ${allSources.length}`;
    }

    sourceSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allSources.filter(s => (s.title || s.filename).toLowerCase().includes(q));
        renderSources(filtered);
    });

    createForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const description = document.getElementById('desc').value;

        try {
            const res = await fetch('/api/notebooks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, description })
            });
            const notebook = await res.json();

            // Link selected sources
            for (const sourceId of selectedSourceIds) {
                await fetch(`/api/notebooks/${notebook.id}/sources`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ sourceId })
                });
            }

            window.location.href = `notebook.html?id=${notebook.id}`;
        } catch (err) {
            alert('Failed to create notebook');
        }
    };

    loadSources();
});
