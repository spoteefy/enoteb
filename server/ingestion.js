const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const db = process.env.NODE_ENV === 'test' ? require('./db_sqlite') : require('./db');

async function extractText(filePath, mimetype) {
    if (!filePath) return '';

    try {
        if (mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            return data.text;
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } else if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
            return fs.readFileSync(filePath, 'utf8');
        }
        return '';
    } catch (e) {
        console.error('Text extraction failed:', e);
        return '';
    }
}

async function processSource(sourceId, content) {
    if (!content) return;

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
        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: apiKey,
        });

        // Use embedDocuments for batch processing
        const vectorEmbeddings = await embeddings.embedDocuments(chunks);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = vectorEmbeddings[i];

            // SQLite expects stringified JSON for embeddings table
            const embeddingVal = process.env.NODE_ENV === 'test' ? JSON.stringify(embedding) : embedding;

            await db.query(
                'INSERT INTO source_chunks (source_id, content, embedding) VALUES ($1, $2, $3)',
                [sourceId, chunk, embeddingVal]
            );
        }
        await db.query('UPDATE sources SET embedding_status = $1 WHERE id = $2', ['ready', sourceId]);
        console.log(`Processed ${chunks.length} chunks for source ${sourceId}`);
    } catch (e) {
        console.error('Processing source failed:', e);
        await db.query('UPDATE sources SET embedding_status = $1 WHERE id = $2', ['failed', sourceId]);
    }
}

module.exports = { extractText, processSource };
