const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");

async function createVectorStore(sources) {
    if (!sources || sources.length === 0) return null;

    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY,
    });

    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });

    const docs = [];
    for (const source of sources) {
        const chunks = await textSplitter.splitText(source.content || "");
        for (const chunk of chunks) {
            try {
                const embedding = await embeddings.embedQuery(chunk);
                docs.push({
                    pageContent: chunk,
                    metadata: { sourceName: source.name },
                    embedding
                });
            } catch (e) {
                console.error("Embedding failed for chunk:", e);
            }
        }
    }
    return docs;
}

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

async function getRelevantContext(docs, query, k = 5) {
    if (!docs || docs.length === 0) return { context: "", citations: [] };

    const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GOOGLE_API_KEY,
    });

    try {
        const queryEmbedding = await embeddings.embedQuery(query);
        const scoredDocs = docs.map(doc => ({
            pageContent: doc.pageContent,
            metadata: doc.metadata,
            score: cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        const results = scoredDocs.sort((a, b) => b.score - a.score).slice(0, k);

        let context = "Tài liệu tham khảo:\n";
        const citations = new Set();
        results.forEach((res, i) => {
            context += `[${i+1}] (${res.metadata.sourceName}): ${res.pageContent}\n\n`;
            citations.add(res.metadata.sourceName);
        });

        return { context, citations: Array.from(citations) };
    } catch (e) {
        console.error("Query embedding failed:", e);
        return { context: "", citations: [] };
    }
}

module.exports = { createVectorStore, getRelevantContext };
