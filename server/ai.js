const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { Annotation, StateGraph, START, END } = require("@langchain/langgraph");
const { HumanMessage, SystemMessage, AIMessage } = require("@langchain/core/messages");
const rag = require('./rag');

const googleApiKey = process.env.GOOGLE_API_KEY;

let model = null;
if (googleApiKey) {
    model = new ChatGoogleGenerativeAI({
        apiKey: googleApiKey,
        modelName: "gemini-1.5-flash",
        maxOutputTokens: 2048,
    });
}

/**
 * Helper to truncate source content to stay within reasonable token limits
 */
function truncateContent(content, maxChars = 10000) {
    if (!content) return "";
    if (content.length <= maxChars) return content;
    return content.substring(0, maxChars) + "... [Nội dung bị cắt do quá dài]";
}

/**
 * Single document or context-based chat
 */
async function chatWithSources(message, sources) {
    if (!model) {
        return {
            response: "Lỗi: GOOGLE_API_KEY chưa được thiết lập. Vui lòng kiểm tra file .env.",
            citations: []
        };
    }

    try {
        const vectorStore = await rag.createVectorStore(sources);
        const { context, citations } = await rag.getRelevantContext(vectorStore, message);

        const systemPrompt = `Bạn là Trợ lý AI của Kho Tri Thức. Bạn có quyền truy cập vào các tài liệu sau đây để trả lời câu hỏi của người dùng.
Hãy trả lời một cách chuyên nghiệp, chính xác dựa TRÊN DỮ LIỆU ĐƯỢC CUNG CẤP.
Nếu thông tin không có trong tài liệu, hãy nói rõ là bạn không biết.

DỮ LIỆU NGUỒN:
${context}`;

        const response = await model.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(message)
        ]);

        return {
            response: response.content,
            citations: citations
        };
    } catch (error) {
        console.error("AI Chat Error:", error);
        throw error;
    }
}

/**
 * LangGraph for multi-document synthesis
 */
const AnalysisState = Annotation.Root({
    sources: Annotation(),
    summary: Annotation(),
    topics: Annotation(),
});

async function summarizeNode(state) {
    const { sources } = state;
    const context = sources.map(s => `[${s.name}]: ${truncateContent(s.content)}`).join("\n\n");

    const prompt = `Hãy tóm tắt nội dung của ${sources.length} tài liệu sau đây một cách súc tích. Tập trung vào các điểm mấu chốt và giá trị cốt lõi.

TÀI LIỆU:
${context}`;

    const response = await model.invoke(prompt);
    return { summary: response.content };
}

async function extractTopicsNode(state) {
    const { sources } = state;
    const context = sources.map(s => `[${s.name}]: ${truncateContent(s.content)}`).join("\n\n");

    const prompt = `Từ các tài liệu sau, hãy trích xuất 2-3 chủ đề quan trọng nhất.
Trả về dưới dạng JSON array: [{"title": "Chủ đề 1", "description": "Mô tả ngắn"}, ...]

TÀI LIỆU:
${context}`;

    const response = await model.invoke(prompt);
    // Basic cleanup if AI returns markdown
    const jsonStr = response.content.replace(/```json/g, "").replace(/```/g, "").trim();
    try {
        const topics = JSON.parse(jsonStr);
        return { topics };
    } catch (e) {
        return { topics: [{ title: "Phân tích nội dung", description: "Đã trích xuất các thông tin quan trọng từ tài liệu." }] };
    }
}

const workflow = new StateGraph(AnalysisState)
    .addNode("summarize", summarizeNode)
    .addNode("extractTopics", extractTopicsNode)
    .addEdge(START, "summarize")
    .addEdge("summarize", "extractTopics")
    .addEdge("extractTopics", END);

const analysisApp = workflow.compile();

async function fastAnalysis(sources) {
    if (!model) {
        return {
            summary: "Lỗi: GOOGLE_API_KEY chưa được thiết lập. Hệ thống đang chạy ở chế độ demo.",
            topics: [{ title: "Cấu hình AI", description: "Vui lòng thêm GOOGLE_API_KEY vào file .env để kích hoạt tính năng này." }]
        };
    }

    try {
        const result = await analysisApp.invoke({ sources });
        return {
            summary: result.summary,
            topics: result.topics
        };
    } catch (error) {
        console.error("AI Analysis Error:", error);
        throw error;
    }
}

module.exports = {
    chatWithSources,
    fastAnalysis,
    generateFlashcards: async (sources) => {
        if (!model) return [];
        const context = sources.map(s => `[${s.name}]: ${truncateContent(s.content, 5000)}`).join("\n\n");
        const prompt = `Dựa trên các tài liệu sau, hãy tạo 5 thẻ ghi nhớ (flashcards) để giúp học tập.
Mỗi thẻ gồm một câu hỏi và một câu trả lời súc tích.
Trả về dưới dạng JSON array: [{"q": "Câu hỏi", "a": "Câu trả lời"}, ...]

TÀI LIỆU:
${context}`;
        try {
            const response = await model.invoke(prompt);
            const jsonStr = response.content.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Flashcard Gen Error:", e);
            return [];
        }
    }
};
