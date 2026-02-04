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
            div.innerHTML = `<span class="material-symbols-outlined text-sm">description</span> ${s.title || s.filename}`;
            sourceList.appendChild(div);
        });

        startAnalysis(selectedSources);
    } catch (err) {
        console.error(err);
    }

    function startAnalysis(sources) {
        summaryText.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> AI đang đọc dữ liệu...';

        setTimeout(() => {
            summaryText.textContent = `Dựa trên ${sources.length} tài liệu bạn đã cung cấp, AI nhận thấy sự kết nối mạnh mẽ giữa các chủ đề nghiên cứu của bạn. Các tài liệu tập trung vào việc tối ưu hóa hiệu suất và ứng dụng các công nghệ mới nhất. Đây là một nền tảng tri thức vững chắc cho các dự án sắp tới.`;

            topicsList.innerHTML = `
                <div class="p-4 bg-slate-800/40 border border-border-dark rounded-lg hover:bg-slate-800/60 transition-colors">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="font-semibold text-primary">Phát triển Công nghệ</h4>
                        <span class="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-bold">Mức độ 1</span>
                    </div>
                    <p class="text-sm text-slate-400">Tập trung vào các xu hướng mới nhất được đề cập trong các báo cáo.</p>
                </div>
                <div class="p-4 bg-slate-800/40 border border-border-dark rounded-lg hover:bg-slate-800/60 transition-colors">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="font-semibold text-primary">Tối ưu hóa Quy trình</h4>
                        <span class="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-bold">Mức độ 2</span>
                    </div>
                    <p class="text-sm text-slate-400">Đề xuất các giải pháp dựa trên dữ liệu từ ghi chú của bạn.</p>
                </div>
            `;

            actionsList.innerHTML = `
                <li class="flex items-start gap-3 p-3 rounded-lg border border-dashed border-slate-700">
                    <span class="material-symbols-outlined text-emerald-400 text-xl mt-0.5">check_circle</span>
                    <div>
                        <p class="text-sm font-medium text-slate-200">Tổng hợp lại các phát hiện quan trọng</p>
                        <p class="text-xs text-slate-500 mt-1">Nên bắt đầu sớm để chuẩn bị cho báo cáo cuối năm.</p>
                    </div>
                </li>
                <li class="flex items-start gap-3 p-3 rounded-lg border border-dashed border-slate-700">
                    <span class="material-symbols-outlined text-emerald-400 text-xl mt-0.5">check_circle</span>
                    <div>
                        <p class="text-sm font-medium text-slate-200">Chia sẻ kết quả với đội ngũ</p>
                        <p class="text-xs text-slate-500 mt-1">Các thông tin này rất hữu ích cho các buổi họp định hướng.</p>
                    </div>
                </li>
            `;
        }, 2000);
    }
});
