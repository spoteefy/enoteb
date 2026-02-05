const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const db = process.env.NODE_ENV === 'test' ? require('./db_sqlite') : require('./db');

async function extractText(filePath, mimetype) {
    if (!filePath) return '';

    try {
        let text = '';
        if (mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            text = data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
        } else if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
            text = fs.readFileSync(filePath, 'utf8');
        }

        // Basic sanitization: remove potential script tags and common attack patterns
        let sanitized = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");

        // Remove suspicious event handlers
        sanitized = sanitized.replace(/on\w+="[^"]*"/gim, "");

        return sanitized;
    } catch (e) {
        console.error('Text extraction failed:', e);
        return '';
    }
}

async function processSource(sourceId, content, retryCount = 0) {
    if (!content) {
        await db.query('UPDATE sources SET embedding_status = $1 WHERE id = $2', ['ready', sourceId]);
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("GEMINI_API_KEY not set. Skipping embedding.");
        await db.query('UPDATE sources SET embedding_status = $1 WHERE id = $2', ['no_key', sourceId]);
        return;
    }

    try {
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const chunks = await textSplitter.splitText(content);
        if (chunks.length === 0) {
             await db.query('UPDATE sources SET embedding_status = $1 WHERE id = $2', ['ready', sourceId]);
             return;
        }

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: apiKey,
        });

        // Batch processing chunks
        const vectorEmbeddings = await embeddings.embedDocuments(chunks);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = vectorEmbeddings[i];
            const embeddingVal = process.env.NODE_ENV === 'test' ? JSON.stringify(embedding) : embedding;

            await db.query(
                'INSERT INTO source_chunks (source_id, content, embedding) VALUES ($1, $2, $3)',
                [sourceId, chunk, embeddingVal]
            );
        }
        await db.query('UPDATE sources SET embedding_status = $1 WHERE id = $2', ['ready', sourceId]);
        console.log(`Processed ${chunks.length} chunks for source ${sourceId}`);
    } catch (e) {
        console.error(`Processing source ${sourceId} failed (attempt ${retryCount + 1}):`, e.message);

        if (retryCount < 2) {
            // Simple exponential backoff
            const delay = Math.pow(2, retryCount) * 1000;
            setTimeout(() => processSource(sourceId, content, retryCount + 1), delay);
        } else {
            await db.query('UPDATE sources SET embedding_status = $1 WHERE id = $2', ['failed', sourceId]);
        }
    }
}

module.exports = { extractText, processSource };
