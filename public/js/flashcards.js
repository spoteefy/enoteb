document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const urlParams = new URLSearchParams(window.location.search);
    const notebookId = urlParams.get('id');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const notebookName = document.getElementById('notebookName');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const cardNumber = document.getElementById('cardNumber');
    const cardText = document.getElementById('cardText');
    const cardSideLabel = document.getElementById('cardSideLabel');
    const flipBtn = document.getElementById('flipBtn');
    const controls = document.getElementById('controls');

    let flashcards = [];
    let currentIndex = 0;
    let isFlipped = false;

    async function loadFlashcards() {
        if (!notebookId) return;

        try {
            notebookName.textContent = 'Đang tải...';
            const res = await fetch(`/api/notebooks/${notebookId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const notebook = await res.json();
            notebookName.textContent = notebook.name;

            const cardsRes = await fetch(`/api/notebooks/${notebookId}/flashcards`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            flashcards = await cardsRes.json();

            if (flashcards.length === 0) {
                if (confirm('Notebook này chưa có flashcards. Bạn có muốn AI tạo thẻ học tập từ tài liệu không?')) {
                    generateCards();
                } else {
                    renderCard();
                }
            } else {
                renderCard();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function generateCards() {
        cardText.textContent = 'Đang tạo thẻ bằng AI...';
        try {
            const res = await fetch('/api/ai/generate-flashcards', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notebookId })
            });
            const data = await res.json();
            if (data.cards) {
                flashcards = data.cards;
                currentIndex = 0;
                renderCard();
            } else {
                cardText.textContent = 'Không thể tạo thẻ. Hãy đảm bảo bạn đã thêm tài liệu vào notebook.';
            }
        } catch (err) {
            console.error(err);
            cardText.textContent = 'Lỗi khi tạo thẻ.';
        }
    }

    function renderCard() {
        if (flashcards.length === 0) {
            cardText.textContent = 'Không có thẻ nào.';
            return;
        }

        const card = flashcards[currentIndex];
        const q = card.question || card.q;
        const a = card.answer || card.a;

        cardText.textContent = isFlipped ? a : q;
        cardSideLabel.textContent = isFlipped ? 'Câu trả lời' : 'Câu hỏi';

        cardNumber.textContent = `Thẻ ${currentIndex + 1}/${flashcards.length}`;
        progressText.textContent = `${currentIndex}/${flashcards.length}`;
        progressBar.style.width = `${(currentIndex / flashcards.length) * 100}%`;

        if (isFlipped) {
            flipBtn.classList.add('hidden');
            controls.classList.remove('hidden');
        } else {
            flipBtn.classList.remove('hidden');
            controls.classList.add('hidden');
        }
    }

    flipBtn.onclick = () => {
        isFlipped = true;
        renderCard();
    };

    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.onclick = () => {
            currentIndex++;
            if (currentIndex >= flashcards.length) {
                alert('Chúc mừng! Bạn đã hoàn thành buổi học hôm nay.');
                window.location.href = `notebook.html?id=${notebookId}`;
            } else {
                isFlipped = false;
                renderCard();
            }
        };
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!isFlipped) {
                isFlipped = true;
                renderCard();
            }
        } else if (isFlipped && (e.key === '1' || e.key === '2' || e.key === '3')) {
            currentIndex++;
            if (currentIndex >= flashcards.length) {
                alert('Chúc mừng! Bạn đã hoàn thành buổi học hôm nay.');
                window.location.href = `notebook.html?id=${notebookId}`;
            } else {
                isFlipped = false;
                renderCard();
            }
        }
    });

    loadFlashcards();
});
