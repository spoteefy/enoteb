document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');
    const notebookId = urlParams.get('notebookId');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const docName = document.getElementById('docName');
    const docMeta = document.getElementById('docMeta');
    const docContent = document.getElementById('docContent');
    const activeCitation = document.getElementById('activeCitation');
    const citationText = document.getElementById('citationText');
    const citationSource = document.getElementById('citationSource');
    const removeCitation = document.getElementById('removeCitation');
    const noteTextarea = document.getElementById('noteTextarea');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const closePreview = document.getElementById('closePreview');

    async function loadDoc() {
        if (!docId) return;

        try {
            const res = await fetch(`/api/sources`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const sources = await res.json();
            const doc = sources.find(s => s.id == docId);

            if (!doc) {
                alert('Document not found');
                return;
            }

            docName.textContent = doc.name;
            docMeta.textContent = `Trình xem tài liệu • ${new Date(doc.updated_at).toLocaleDateString()}`;

            docContent.innerHTML = `
                <h2 class="text-3xl font-bold text-slate-900 mb-8">${doc.name}</h2>
                <div class="text-base leading-relaxed text-slate-700 whitespace-pre-wrap">${doc.content || 'Không có nội dung.'}</div>
            `;

            setupCitation();
        } catch (err) {
            console.error(err);
        }
    }

    function setupCitation() {
        document.addEventListener('mouseup', () => {
            const selection = window.getSelection().toString().trim();
            if (selection.length > 10) {
                activeCitation.classList.remove('hidden');
                citationText.textContent = `"${selection}"`;
                citationSource.textContent = `Nguồn: ${docName.textContent}`;
            }
        });
    }

    removeCitation.onclick = () => {
        activeCitation.classList.add('hidden');
    };

    saveNoteBtn.onclick = async () => {
        const text = noteTextarea.value.trim();
        if (!text) return;

        if (!notebookId) {
            alert('Vui lòng mở tài liệu từ một Notebook để lưu ghi chú.');
            return;
        }

        saveNoteBtn.textContent = 'Đang lưu...';
        try {
            const citation = citationText.textContent;
            const content = `<blockquote>${citation}</blockquote><br><p>${text}</p>`;

            await fetch('/api/notes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notebook_id: notebookId,
                    title: `Ghi chú từ ${docName.textContent}`,
                    content: content
                })
            });

            saveNoteBtn.textContent = 'Đã lưu!';
            setTimeout(() => {
                saveNoteBtn.textContent = 'Lưu ghi chú';
                noteTextarea.value = '';
                activeCitation.classList.add('hidden');
            }, 2000);
        } catch (e) {
            alert('Lỗi khi lưu ghi chú');
            saveNoteBtn.textContent = 'Lưu ghi chú';
        }
    };

    closePreview.onclick = () => {
        history.back();
    };

    loadDoc();
});
