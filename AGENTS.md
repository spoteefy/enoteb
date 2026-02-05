# Kho Tri Thức - Agent Instructions & Documentation

## Overview
This project is a localized "NotebookLM" clone named **Kho Tri Thức**. It features a multi-user environment, AI-powered document analysis (RAG), and a high-fidelity UI matching the provided design specifications.

## Technology Stack
- **Frontend:** Vanilla JavaScript, Tailwind CSS (CDN), Material Symbols.
- **Backend:** Node.js, Express.
- **Database:** PostgreSQL (Primary requirement) with SQLite fallback.
- **AI:** Google Gemini (Generative AI) for embeddings and chat.

## Database Setup
The application is designed to run with PostgreSQL for production/local deployment.
1. Install PostgreSQL.
2. Create a database named `kho_tri_thuc`.
3. Set the `DATABASE_URL` environment variable:
   ```bash
   DATABASE_URL=postgres://user:password@localhost:5432/kho_tri_thuc
   ```
4. On startup, the server will automatically run migrations defined in `server/db.js`.

*Note: For development in environments without PostgreSQL, it falls back to `server/database.db` (SQLite).*

## AI Configuration
To enable RAG features:
1. Obtain a Google Gemini API Key.
2. Add it to `.env`:
   ```bash
   GEMINI_API_KEY=your_key_here
   ```

## Key Features Logic
- **Ownership:** Every source, notebook, and note is tied to a `user_id`. Middleware in `server/app.js` ensures users can only access their own data.
- **Ingestion:** Uploaded files (PDF, DOCX, etc.) are parsed using `server/ingestion.js` and stored as plain text.
- **RAG:** Context retrieval is handled in `server/rag.js` using manual cosine similarity with Gemini embeddings. Chunks are pre-computed during ingestion and stored in `source_chunks`.
- **Analyses:** AI analysis results are persisted in the `analyses` table, allowing for historical retrieval and cross-device consistency.
- **Trash:** Deleted items are kept for 30 days. A background cron-like task in `server/app.js` performs periodic cleanup.

## UI Verification
Visual verification was performed using Playwright to ensure 100% design fidelity. All functional buttons (Login, Dashboard, Notebook Workspace, AI Chat, Flashcards, Settings, Trash) have been tested for correct logic and database integration.
