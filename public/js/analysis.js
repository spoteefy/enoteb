document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const selectedIds = JSON.parse(localStorage.getItem('selectedSources') || '[]');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (selectedIds.length === 0) {
        alert('Vui lòng chọn ít nhất một tài liệu để phân tích.');
        window.location.href = 'dashboard.html';
        return;
    }

    const analysisMeta = document.getElementById('analysisMeta');
    const sourceList = document.getElementById('sourceList');
    const summaryText = document.getElementById('summaryText');
    const topicsList = document.getElementById('topicsList');
    const actionsList = document.getElementById('actionsList');

    analysisMeta.textContent = `Tổng hợp từ ${selectedIds.length} tài liệu đã chọn`;

    // Fetch and display source names
    try {
        const res = await fetch('/api/sources', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const allSources = await res.json();
        const selectedSources = allSources.filter(s => selectedIds.includes(s.id));

        sourceList.innerHTML = '';
        selectedSources.forEach(s => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300';
            div.innerHTML = `<span class="material-symbols-outlined text-sm">description</span> ${s.name}`;
            sourceList.appendChild(div);
        });

        displayAnalysis();
    } catch (err) {
        console.error(err);
    }

    function displayAnalysis() {
        const data = JSON.parse(localStorage.getItem('lastAnalysis'));
        if (!data) {
            summaryText.textContent = "Không tìm thấy dữ liệu phân tích.";
            return;
        }

        summaryText.textContent = data.summary;

        topicsList.innerHTML = '';
        (data.topics || []).forEach((topic, i) => {
            const div = document.createElement('div');
            div.className = 'p-4 bg-slate-800/40 border border-border-dark rounded-lg hover:bg-slate-800/60 transition-colors';
            div.innerHTML = `
                <div class="flex justify-between items-start mb-1">
                    <h4 class="font-semibold text-primary">${topic.title}</h4>
                    <span class="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-bold">Mức độ ${i+1}</span>
                </div>
                <p class="text-sm text-slate-400">${topic.description}</p>
            `;
            topicsList.appendChild(div);
        });

        // Actions remain static or could be generated if AI provided them
        actionsList.innerHTML = `
            <li class="flex items-start gap-3 p-3 rounded-lg border border-dashed border-slate-700">
                <span class="material-symbols-outlined text-emerald-400 text-xl mt-0.5">check_circle</span>
                <div>
                    <p class="text-sm font-medium text-slate-200">Tổng hợp lại các phát hiện quan trọng</p>
                    <p class="text-xs text-slate-500 mt-1">Dựa trên tóm tắt của AI ở trên.</p>
                </div>
            </li>
        `;
    }
});
