document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const resultCount = document.getElementById('resultCount');
    const resultsList = document.getElementById('resultsList');
    const aiAnalysisIntro = document.getElementById('aiAnalysisIntro');
    const aiAnalysisContent = document.getElementById('aiAnalysisContent');
    const suggestedTopics = document.getElementById('suggestedTopics');

    searchBtn.onclick = async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        resultsList.innerHTML = '<div class="text-center py-10"><span class="material-symbols-outlined animate-spin text-primary">sync</span></div>';

        try {
            const res = await fetch(`/api/sources?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const results = await res.json();
            renderResults(results, query);
            generateAIAnalysis(query, results);
        } catch (err) {
            resultsList.innerHTML = '<p class="text-red-500">Search failed.</p>';
        }
    };

    function renderResults(results, query) {
        resultCount.textContent = `Kết quả tìm kiếm (${results.length})`;
        resultsList.innerHTML = '';

        if (results.length === 0) {
            resultsList.innerHTML = '<p class="text-slate-500 text-center py-10">Không tìm thấy kết quả phù hợp.</p>';
            return;
        }

        results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'bg-white dark:bg-surface-dark p-5 rounded-2xl border border-slate-200 dark:border-border-dark hover:border-primary/50 transition-all group cursor-pointer';

            const format = item.name ? item.name.split('.').pop().toUpperCase() : 'NOTE';
            const icon = format === 'PDF' ? 'picture_as_pdf' : 'description';
            const iconColor = format === 'PDF' ? 'text-red-600' : 'text-blue-600';
            const iconBg = format === 'PDF' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30';

            const highlightedTitle = item.name.replace(new RegExp(query, 'gi'), match => `<span class="highlight-text">${match}</span>`);

            div.innerHTML = `
                <div class="flex items-start justify-between gap-4 mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}">
                            <span class="material-symbols-outlined">${icon}</span>
                        </div>
                        <div>
                            <h4 class="font-bold text-lg group-hover:text-primary transition-colors">${highlightedTitle}</h4>
                            <p class="text-xs text-slate-400">${format} • Cập nhật ${new Date(item.updated_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <button class="text-slate-400 hover:text-primary"><span class="material-symbols-outlined">bookmark</span></button>
                </div>
                <p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2">
                    ${item.content ? item.content.substring(0, 150) + '...' : `Tài liệu liên quan đến "${query}".`}
                </p>
            `;

            div.onclick = () => {
                window.location.href = `preview.html?id=${item.id}`;
            };
            resultsList.appendChild(div);
        });
    }

    async function generateAIAnalysis(query, results) {
        if (results.length === 0) {
            aiAnalysisIntro.innerHTML = "Không có đủ dữ liệu để AI phân tích.";
            aiAnalysisContent.innerHTML = "";
            return;
        }

        aiAnalysisIntro.innerHTML = `Dựa trên ${results.length} tài liệu trong kho tri thức của bạn, đây là tóm tắt về <strong>"${query}"</strong>:`;
        aiAnalysisContent.innerHTML = '<div class="flex justify-center"><span class="material-symbols-outlined animate-spin">sync</span></div>';

        try {
            const sourceIds = results.map(r => r.id);
            const res = await fetch('/api/ai/fast-analysis', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sourceIds })
            });
            const data = await res.json();

            let summaryHtml = data.summary;
            if (typeof marked !== 'undefined') {
                summaryHtml = marked.parse(data.summary);
            }

            aiAnalysisContent.innerHTML = `
                <div class="flex flex-col gap-4 prose dark:prose-invert text-sm">
                    ${summaryHtml}
                </div>
            `;

            suggestedTopics.innerHTML = '';
            (data.topics || []).forEach(topic => {
                const btn = document.createElement('button');
                btn.className = "px-3 py-1.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg text-xs font-medium hover:text-primary hover:border-primary transition-all flex items-center gap-1";
                btn.innerHTML = `<span class="material-symbols-outlined text-sm">local_offer</span> ${topic.title}`;
                suggestedTopics.appendChild(btn);
            });
        } catch (e) {
            aiAnalysisContent.innerHTML = '<p class="text-red-500 text-sm">AI analysis failed.</p>';
        }
    }
});
