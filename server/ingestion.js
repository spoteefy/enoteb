const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');

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

module.exports = { extractText };
