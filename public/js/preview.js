document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');

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

            docName.textContent = doc.title || doc.filename;
            docMeta.textContent = `Trình xem tài liệu • ${new Date(doc.updated_at).toLocaleDateString()}`;

            // Mock content
            docContent.innerHTML = `
                <h2 class="text-3xl font-bold text-slate-900 mb-8">${doc.title || doc.filename}</h2>
                <p class="text-base leading-relaxed text-slate-700">Đây là nội dung của tài liệu được trích xuất. Bạn có thể bôi đen văn bản để tạo trích dẫn.</p>
                <div class="relative p-4 bg-slate-50 border-l-4 border-primary selectable-text">
                    Các mô hình ngôn ngữ lớn (LLM) hiện nay không chỉ dừng lại ở việc xử lý văn bản, mà còn có khả năng tích hợp đa phương thức, cho phép AI hiểu và tạo ra cả hình ảnh, âm thanh và mã nguồn với độ chính xác vượt trội. Điều này sẽ rút ngắn quy trình phát triển sản phẩm từ vài tháng xuống còn vài ngày.
                </div>
                <p class="text-base leading-relaxed text-slate-700 mt-6">
                    Khảo sát từ Gartner cho thấy 80% các nhà lãnh đạo CNTT đang lên kế hoạch triển khai ít nhất một ứng dụng Generative AI trong vòng 12 tháng tới.
                </p>
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

        // Simulate saving
        saveNoteBtn.textContent = 'Đang lưu...';
        setTimeout(() => {
            saveNoteBtn.textContent = 'Đã lưu!';
            setTimeout(() => saveNoteBtn.textContent = 'Lưu ghi chú', 2000);
            noteTextarea.value = '';
            activeCitation.classList.add('hidden');
        }, 1000);
    };

    closePreview.onclick = () => {
        history.back();
    };

    loadDoc();
});
