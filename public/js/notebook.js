document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const urlParams = new URLSearchParams(window.location.search);
    const notebookId = urlParams.get('id');

    if (!token || !notebookId) {
        window.location.href = '/dashboard.html';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.querySelectorAll('.user-name').forEach(el => el.textContent = user.full_name);
    }

    fetchNotebookDetails(notebookId);
    fetchSources(notebookId);
    fetchNotes(notebookId);

    // --- AI Chat Logic ---
    const chatInput = document.querySelector('#chat-input');
    const chatSendBtn = document.querySelector('#chat-send-btn');
    const chatContainer = document.querySelector('#chat-container');

    if (chatInput && chatSendBtn) {
        chatSendBtn.onclick = async () => {
            const message = chatInput.value;
            if (!message) return;

            appendChatMessage('You', message);
            chatInput.value = '';

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message, notebookId })
            });
            const data = await res.json();
            appendChatMessage('AI Assistant', data.response);
        };
    }

    function appendChatMessage(role, text) {
        const div = document.createElement('div');
        div.className = role === 'You' ? 'flex flex-col gap-2 items-end' : 'flex flex-col gap-2 max-w-[90%]';
        div.innerHTML = `
            <div class="p-4 rounded-2xl ${role === 'You' ? 'rounded-tr-none bg-primary text-white' : 'rounded-tl-none bg-gray-100 dark:bg-[#1a212f] text-gray-800 dark:text-gray-200'} text-sm leading-relaxed shadow-lg">
                ${text}
            </div>
            <span class="text-[10px] text-[#9da6b9] ${role === 'You' ? 'mr-1' : 'ml-1'} font-medium">${role} • Just now</span>
        `;
        chatContainer.appendChild(div);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // --- Source Upload ---
    const uploadBtn = document.querySelector('#add-source-btn');
    if (uploadBtn) {
        uploadBtn.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = async () => {
                const formData = new FormData();
                formData.append('file', input.files[0]);
                formData.append('name', input.files[0].name);
                formData.append('type', 'pdf'); // Simplified

                await fetch(`/api/notebooks/${notebookId}/sources`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                fetchSources(notebookId);
            };
            input.click();
        };
    }
});

async function fetchNotebookDetails(id) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/notebooks/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const nb = await res.json();
    document.querySelector('h2.text-gray-900.dark\\:text-white').textContent = nb.name;
    document.querySelector('p.text-\\[\\#9da6b9\\]').textContent = nb.description || 'Kho tri thức của bạn';
}

async function fetchSources(notebookId) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/notebooks/${notebookId}/sources`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const sources = await res.json();
    const container = document.querySelector('.flex-1.overflow-y-auto.px-2 .flex.flex-col.gap-1');
    const sourceCountEl = document.querySelector('.ml-auto.text-xs.bg-primary\\/20.px-2\\.5.py-0\\.5.rounded-full.font-bold');
    if (sourceCountEl) sourceCountEl.textContent = sources.length;

    if (!container) return;
    container.innerHTML = '';
    sources.forEach(s => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/50 dark:hover:bg-white/10 cursor-pointer transition-all group";
        item.onclick = () => window.location.href = `/preview.html?id=${s.id}&name=${encodeURIComponent(s.name)}`;
        item.innerHTML = `
            <div class="text-red-500 flex items-center justify-center rounded-lg bg-red-500/10 shrink-0 size-10 group-hover:scale-105 transition-transform">
                <span class="material-symbols-outlined text-xl">picture_as_pdf</span>
            </div>
            <div class="flex flex-col justify-center overflow-hidden">
                <p class="text-gray-900 dark:text-white text-sm font-semibold leading-tight truncate">${s.name}</p>
                <p class="text-[#9da6b9] text-[10px] font-normal leading-tight mt-1">Recently updated</p>
            </div>
        `;
        container.appendChild(item);
    });
}

async function fetchNotes(notebookId) {
    // Similar logic for notes if needed, but for now focus on UI consistency
}
