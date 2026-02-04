# Kho Tri Thức - Project Documentation

## AI Integration
This project uses **LangChain** and **LangGraph** with **Google Gemini API** for its AI features.

### Features
- **Smart Chat:** Context-aware chat within notebooks, using selected sources as retrieval context.
- **Fast Analysis:** Multi-document synthesis using a LangGraph workflow that generates a summary and extracts key topics.

### Configuration
To enable AI features, you must provide a `GOOGLE_API_KEY` in your `.env` file. You can obtain one from the [Google AI Studio](https://aistudio.google.com/).

### Backend Architecture
- `server/ai.js`: Contains the LangChain models and LangGraph workflows.
- `server/app.js`: Main Express server, calling the AI Service.
- `server/db.js`: PostgreSQL database interface.
