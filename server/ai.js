const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { HumanMessage, SystemMessage } = require("@langchain/core/messages");
const rag = require('./rag');

const apiKey = process.env.GEMINI_API_KEY;

let model = null;
if (apiKey) {
    model = new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        modelName: "gemini-1.5-flash",
        maxOutputTokens: 2048,
    });
}

/**
 * Chat with RAG context
 */
async function chatWithSources(message, sources) {
    if (!model) {
        return {
            response: "Lỗi: GEMINI_API_KEY chưa được thiết lập. Vui lòng kiểm tra file .env.",
            citations: []
        };
    }

    try {
        const { context, citations } = await rag.getRelevantContext(sources, message);

        const systemPrompt = `Bạn là Trợ lý AI của Kho Tri Thức. Bạn có quyền truy cập vào các tài liệu sau đây để trả lời câu hỏi của người dùng.
Hãy trả lời một cách chuyên nghiệp, chính xác dựa TRÊN DỮ LIỆU ĐƯỢC CUNG CẤP.
Sử dụng định dạng Markdown để trả lời dễ đọc hơn (bold, lists, v.v.).
Nếu thông tin không có trong tài liệu, hãy nói rõ là bạn không biết.

DỮ LIỆU NGUỒN:
${context}`;

        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(message)
        ]);

        return {
            response: response.content,
            citations: citations,
            status: 'success'
        };
    } catch (error) {
        console.error("AI Chat Error:", error);
        throw error;
    }
}

/**
 * Perform analysis using retrieved context
 */
async function fastAnalysis(sources) {
    if (!model) {
        return {
            summary: "Lỗi: GEMINI_API_KEY chưa được thiết lập. Hệ thống đang chạy ở chế độ demo.",
            topics: [{ title: "Cấu hình AI", description: "Vui lòng thêm GEMINI_API_KEY vào file .env để kích hoạt tính năng này." }]
        };
    }

    try {
        // Use RAG to get the most relevant parts if documents are too many/large
        // For analysis, we might want a broader context, so we query for a "summary" query
        const { context } = await rag.getRelevantContext(sources, "Tóm tắt các điểm chính, xu hướng và thông tin quan trọng nhất", 15);

        const prompt = `Hãy phân tích nội dung sau đây và cung cấp:
1. Một bản tóm tắt súc tích (summary).
2. Các chủ đề chính (topics) dưới dạng JSON array: [{"title": "Chủ đề", "description": "Mô tả"}]

DỮ LIỆU:
${context}

Trả về kết quả theo định dạng:
SUMMARY: [Nội dung tóm tắt]
TOPICS: [{"title": "...", "description": "..."}]`;

        const response = await model.invoke(prompt);
        const text = response.content;

        const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=TOPICS:|$)/i);
        const topicsMatch = text.match(/TOPICS:\s*([\s\S]*)$/i);

        let summary = summaryMatch ? summaryMatch[1].trim() : "Không thể tóm tắt.";
        let topics = [];
        if (topicsMatch) {
            try {
                const jsonStr = topicsMatch[1].replace(/```json/g, "").replace(/```/g, "").trim();
                topics = JSON.parse(jsonStr);
            } catch (e) {
                topics = [{ title: "Phân tích nội dung", description: "Đã trích xuất các thông tin quan trọng từ tài liệu." }];
            }
        }

        return { summary, topics };
    } catch (error) {
        console.error("AI Analysis Error:", error);
        throw error;
    }
}

async function generateFlashcards(sources) {
    if (!model) return [];

    try {
        const { context } = await rag.getRelevantContext(sources, "Các khái niệm quan trọng, định nghĩa, số liệu và sự kiện cần ghi nhớ", 15);

        const prompt = `Dựa trên dữ liệu sau, hãy tạo 5-10 thẻ ghi nhớ (flashcards) để giúp học tập.
Mỗi thẻ gồm một câu hỏi và một câu trả lời súc tích.
Trả về duy nhất một JSON array: [{"q": "Câu hỏi", "a": "Câu trả lời"}]

DỮ LIỆU:
${context}`;

        const response = await model.invoke(prompt);
        const jsonStr = response.content.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Flashcard Gen Error:", e);
        return [];
    }
}

module.exports = {
    chatWithSources,
    fastAnalysis,
    generateFlashcards
};
