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

            const format = item.filename ? item.filename.split('.').pop().toUpperCase() : 'NOTE';
            const icon = format === 'PDF' ? 'picture_as_pdf' : 'description';
            const iconColor = format === 'PDF' ? 'text-red-600' : 'text-blue-600';
            const iconBg = format === 'PDF' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30';

            const title = item.title || item.filename;
            const highlightedTitle = title.replace(new RegExp(query, 'gi'), match => `<span class="highlight-text">${match}</span>`);

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
                    Tài liệu liên quan đến "${query}". Xem chi tiết để biết thêm thông tin về các ứng dụng và nghiên cứu.
                </p>
            `;

            div.onclick = () => {
                window.location.href = `preview.html?id=${item.id}`;
            };
            resultsList.appendChild(div);
        });
    }

    async function generateAIAnalysis(query, results) {
        aiAnalysisIntro.innerHTML = `Dựa trên ${results.length} tài liệu trong kho tri thức của bạn, đây là tóm tắt về <strong>"${query}"</strong>:`;
        aiAnalysisContent.innerHTML = '<div class="flex justify-center"><span class="material-symbols-outlined animate-spin">sync</span></div>';

        // Simulate AI thinking
        setTimeout(() => {
            aiAnalysisContent.innerHTML = `
                <div class="flex items-start gap-3">
                    <div class="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>
                    <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span class="font-semibold text-slate-900 dark:text-white">Xu hướng hiện tại:</span>
                        Phân tích cho thấy "${query}" đang là tâm điểm chú ý với nhiều ứng dụng thực tiễn trong công nghiệp.
                    </p>
                </div>
                <div class="flex items-start gap-3">
                    <div class="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>
                    <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span class="font-semibold text-slate-900 dark:text-white">Dữ liệu từ kho:</span>
                        Các tài liệu của bạn đề cập đến việc tối ưu hóa quy trình thông qua "${query}".
                    </p>
                </div>
            `;

            suggestedTopics.innerHTML = `
                <button class="px-3 py-1.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg text-xs font-medium hover:text-primary hover:border-primary transition-all flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">search</span>
                    Ứng dụng của ${query}
                </button>
                <button class="px-3 py-1.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg text-xs font-medium hover:text-primary hover:border-primary transition-all flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">search</span>
                    Tương lai ${query} 2025
                </button>
            `;
        }, 1500);
    }
});
