const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const db = process.env.NODE_ENV === 'test' ? require('./db_sqlite') : require('./db');

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getRelevantContext(sources, query, k = 10) {
    if (!sources || sources.length === 0) return { context: "", citations: [] };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { context: "Lỗi: GEMINI_API_KEY chưa được thiết lập.", citations: [] };

    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: apiKey,
    });

    try {
        const sourceIds = sources.map(s => s.id);
        const placeholders = sourceIds.map((_, i) => `$${i + 1}`).join(',');

        // Fetch all pre-computed chunks for these sources
        const result = await db.query(
            `SELECT sc.*, s.name as source_name FROM source_chunks sc JOIN sources s ON s.id = sc.source_id WHERE sc.source_id IN (${placeholders})`,
            sourceIds
        );

        const chunks = result.rows;
        if (chunks.length === 0) {
            // Fallback: If no chunks found, return first source content as a single block (not ideal but safe)
            return { context: sources[0].content || "", citations: [sources[0].name] };
        }

        const queryEmbedding = await embeddings.embedQuery(query);

        const scoredChunks = chunks.map(chunk => {
            const chunkEmbedding = typeof chunk.embedding === 'string' ? JSON.parse(chunk.embedding) : chunk.embedding;
            return {
                content: chunk.content,
                sourceName: chunk.source_name,
                score: cosineSimilarity(queryEmbedding, chunkEmbedding)
            };
        });

        const topResults = scoredChunks.sort((a, b) => b.score - a.score).slice(0, k);

        let context = "Tài liệu tham khảo:\n";
        const citations = new Set();
        topResults.forEach((res, i) => {
            context += `[${i+1}] (${res.sourceName}): ${res.content}\n\n`;
            citations.add(res.sourceName);
        });

        return { context, citations: Array.from(citations) };
    } catch (e) {
        console.error("RAG Context retrieval failed:", e);
        return { context: "", citations: [] };
    }
}

module.exports = { getRelevantContext };
