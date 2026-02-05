// Notebook Workspace Logic
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const notebookId = params.get('id');
    if (!notebookId) {
        window.location.href = 'dashboard.html';
        return;
    }

    const nbName = document.getElementById('nbName');
    const nbDesc = document.getElementById('nbDesc');
    const sourcesCount = document.getElementById('sourcesCount');
    const notesCount = document.getElementById('notesCount');
    const libraryList = document.getElementById('libraryList');
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    const contentTitle = document.getElementById('contentTitle');
    const contentText = document.getElementById('contentText');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const emptyState = document.getElementById('emptyState');
    const contentView = document.getElementById('contentView');
    const quickAnalyzeBtn = document.getElementById('quickAnalyzeBtn');

    let currentSources = [];
    let currentNotes = [];
    let activeItem = null;

    async function loadNotebook() {
        const nb = await apiRequest(`/notebooks/${notebookId}`);
        nbName.textContent = nb.name;
        nbDesc.textContent = nb.description || 'Project Workspace';
        await loadSources();
        await loadNotes();
        if (currentSources.length === 0 && currentNotes.length === 0) showEmptyState();
        else showContentView();
    }

    async function loadSources() {
        currentSources = await apiRequest(`/notebooks/${notebookId}/sources`);
        sourcesCount.textContent = currentSources.length;
        renderLibrary();
    }

    async function loadNotes() {
        currentNotes = await apiRequest(`/notebooks/${notebookId}/notes`);
        notesCount.textContent = currentNotes.length;
        renderLibrary();
    }

    function renderLibrary() {
        libraryList.innerHTML = '';
        currentSources.forEach(s => {
            const item = document.createElement('div');
            item.className = `flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer group ${activeItem?.id === s.id && activeItem?.type === 'source' ? 'bg-primary/10' : ''}`;

            let statusIcon = '';
            if (s.embedding_status === 'ready') statusIcon = '<span class="material-symbols-outlined text-[12px] text-green-500" title="AI Sẵn sàng">auto_awesome</span>';
            else if (s.embedding_status === 'pending') statusIcon = '<span class="material-symbols-outlined text-[12px] text-amber-500 animate-spin" title="Đang xử lý AI">sync</span>';
            else if (s.embedding_status === 'no_key' || s.embedding_status === 'failed') statusIcon = '<span class="material-symbols-outlined text-[12px] text-red-500" title="AI chưa sẵn sàng">error</span>';

            item.innerHTML = `
                <input type="checkbox" class="source-active-check w-4 h-4 rounded border-slate-300 text-primary" ${s.is_active ? 'checked' : ''}>
                <div class="text-red-500 flex items-center justify-center rounded-lg bg-red-500/10 shrink-0 size-8">
                    <span class="material-symbols-outlined text-base">picture_as_pdf</span>
                </div>
                <div class="flex flex-col flex-1 min-w-0">
                    <p class="text-xs font-semibold truncate">${s.name}</p>
                    ${statusIcon}
                </div>
                <button class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity preview-btn">
                    <span class="material-symbols-outlined text-sm">open_in_full</span>
                </button>
            `;
            item.querySelector('p').onclick = () => selectSource(s);
            item.querySelector('.preview-btn').onclick = (e) => {
                e.stopPropagation();
                window.location.href = `preview.html?id=${s.id}&notebookId=${notebookId}`;
            };
            item.querySelector('.source-active-check').onchange = async (e) => {
                await apiRequest(`/notebooks/${notebookId}/sources/${s.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ is_active: e.target.checked })
                });
            };
            libraryList.appendChild(item);
        });

        currentNotes.forEach(n => {
            const item = document.createElement('div');
            item.className = `flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer group ${activeItem?.id === n.id && activeItem?.type === 'note' ? 'bg-primary/10' : ''}`;
            item.innerHTML = `
                <div class="w-4 h-4"></div>
                <div class="text-blue-500 flex items-center justify-center rounded-lg bg-blue-500/10 shrink-0 size-8">
                    <span class="material-symbols-outlined text-base">edit_note</span>
                </div>
                <p class="text-xs font-semibold truncate flex-1">${n.title}</p>
            `;
            item.onclick = () => selectNote(n);
            libraryList.appendChild(item);
        });
    }

    function selectSource(source) {
        activeItem = { type: 'source', id: source.id };
        breadcrumbCurrent.textContent = source.name;
        contentTitle.textContent = source.name;
        contentText.innerHTML = `<p>${source.content || 'No content.'}</p>`;
        contentTitle.contentEditable = false;
        contentText.contentEditable = false;
        saveNoteBtn.classList.add('hidden');
        renderLibrary();
    }

    function selectNote(note) {
        activeItem = { type: 'note', id: note.id };
        breadcrumbCurrent.textContent = note.title;
        contentTitle.textContent = note.title;
        contentText.innerHTML = note.content || '<p>Start writing...</p>';
        contentTitle.contentEditable = true;
        contentText.contentEditable = true;
        saveNoteBtn.classList.remove('hidden');
        renderLibrary();
    }

    function showEmptyState() { emptyState.classList.remove('hidden'); contentView.classList.add('hidden'); }
    function showContentView() { emptyState.classList.add('hidden'); contentView.classList.remove('hidden'); }

    saveNoteBtn.onclick = async () => {
        if (activeItem?.type !== 'note') return;
        await apiRequest(`/notes/${activeItem.id}`, {
            method: 'PUT',
            body: JSON.stringify({ title: contentTitle.textContent, content: contentText.innerHTML })
        });
        loadNotes();
    };

    document.getElementById('addSourceBtn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', file.name);
            formData.append('type', 'pdf');
            const token = localStorage.getItem('token');
            // Upload to general edrive then link to this notebook
            const res = await fetch('/api/sources', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const source = await res.json();
            await apiRequest(`/notebooks/${notebookId}/link-source`, {
                method: 'POST',
                body: JSON.stringify({ sourceId: source.id })
            });
            loadSources();
        };
        input.click();
    };

    quickAnalyzeBtn.onclick = async () => {
        const data = await apiRequest('/ai/fast-analysis', {
            method: 'POST',
            body: JSON.stringify({ notebookId })
        });
        localStorage.setItem('lastAnalysis', JSON.stringify(data));
        localStorage.setItem('lastAnalysisSources', JSON.stringify(currentSources.filter(s => s.is_active)));
        window.location.href = 'analysis.html';
    };

    sendChatBtn.onclick = async () => {
        const message = chatInput.value.trim();
        if (!message) return;
        addChatMessage('You', message, true);
        chatInput.value = '';
        const data = await apiRequest('/ai/chat', { method: 'POST', body: JSON.stringify({ message, notebookId }) });
        addChatMessage('AI Assistant', data.response, false, data.citations);
    };

    function addChatMessage(sender, text, isUser, citations = []) {
        const div = document.createElement('div');
        div.className = `flex flex-col gap-2 ${isUser ? 'items-end' : 'max-w-[90%]'}`;
        div.innerHTML = `
            <div class="p-4 rounded-2xl ${isUser ? 'rounded-tr-none bg-primary text-white shadow-lg' : 'rounded-tl-none bg-gray-100 dark:bg-[#1a212f] text-gray-800 dark:text-gray-200 border border-white/5'} text-sm leading-relaxed">
                ${text}
                ${citations.length > 0 ? `<div class="mt-4 flex flex-wrap gap-2">${citations.map(c => `<span class="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg border border-primary/20">${c}</span>`).join('')}</div>` : ''}
            </div>
            <span class="text-[10px] text-[#9da6b9] font-medium">${sender} • Just now</span>
        `;
        chatHistory.appendChild(div);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    loadNotebook();
});
