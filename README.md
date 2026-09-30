# Company AI Chatbot Backend

This project provides a production-ready ChatGPT-style backend built with Python, FastAPI, and the official OpenAI Python SDK. It exposes a clean REST API that can be integrated into a company portal, internal tool, or frontend application.

## Features

- FastAPI application with REST endpoints
- OpenAI chat completion integration using the official OpenAI SDK
- Conversation tracking with `conversation_id`
- SQLite for local development and PostgreSQL-ready configuration for production
- Modular RAG layer for company documents and PDF ingestion
- Tool registry scaffold for web search or related service integrations
- Pydantic validation for request payloads
- CORS support for frontend/company application integration
- Clean JSON error responses
- Environment variable configuration via `.env`
- Example React frontend application that calls the API

## Project Structure

- `main.py` — FastAPI app and API routes
- `openai_service.py` — OpenAI client wrapper and chat completion logic
- `database.py` — SQLAlchemy models and database utilities
- `rag.py` — retrieval-augmented generation (RAG) logic for documents and PDFs
- `tools.py` — future tool integrations such as search or external APIs
- `requirements.txt` — Python dependencies
- `.env` — environment variables, including the OpenAI API key
- `documents/` — sample company documents for RAG testing
- `frontend/` — minimal React client example for calling the backend
- `.gitignore` — ignores local secrets and generated files

## 1. Install Python dependencies

From the project root:

```bash
python -m venv .venv
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
source .venv/bin/activate
```

Then install dependencies:

```bash
pip install -r requirements.txt
```

## 2. Create the `.env` file

The project includes a `.env` file in the root directory. Add your real OpenAI key there.

Example:

```env
OPENAI_API_KEY=your_actual_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
DATABASE_URL=sqlite:///./chatbot.db
RAG_DOCUMENTS_PATH=documents
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000
APP_NAME=Company AI Chatbot API
```

For production PostgreSQL:

```env
DATABASE_URL=postgresql://chatbot_user:your_password@localhost:5432/chatbot_db
```

Important:

- Never hardcode your OpenAI API key in frontend code.
- Keep the secret only in the server-side `.env` file.
- Do not commit the `.env` file to version control.

## 3. Start the FastAPI server

From the project root:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at:

- http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- ReDoc docs: http://localhost:8000/redoc

## 4. Test the `/chat` endpoint

### Example request using curl

```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Summarize the key responsibilities of the support team.",
    "user_name": "Alice",
    "conversation_id": "demo-conversation-1"
  }'
```

### Example request using Python

```python
import requests

response = requests.post(
    "http://localhost:8000/chat",
    json={
        "message": "Write a short onboarding summary for new employees.",
        "user_name": "Alice",
        "conversation_id": "demo-conversation-1",
    },
    timeout=60,
)

print(response.status_code)
print(response.json())
```

## 5. Example API responses

### Successful response

```json
{
  "conversation_id": "demo-conversation-1",
  "response": "Here is a brief onboarding summary...",
  "model": "gpt-4o-mini",
  "user_id": "8b3ff8cb-0d6d-4a6f-bd4e-c3c62a7d4a1d",
  "tool_status": "ready"
}
```

### Error response

```json
{
  "detail": "OPENAI_API_KEY is not configured. Add your key to the .env file before calling /chat."
}
```

## 6. How another application can integrate

This backend is designed to be a reusable API for another app, service, or frontend.

### Example integration in JavaScript

```javascript
const response = await fetch("http://localhost:8000/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "Can you help me summarize this account update?",
    user_name: "Employee",
    conversation_id: "tenant-123",
  }),
});

const data = await response.json();
console.log(data.response);
```

### Example integration in Python

```python
import requests

payload = {
    "message": "Give me a short explanation of our onboarding process.",
    "user_name": "Ops Team",
    "conversation_id": "ops-chat-42",
}

result = requests.post("http://localhost:8000/chat", json=payload, timeout=60)
print(result.json())
```

## 7. Database behavior

The project uses SQLite for local development and is prepared for PostgreSQL in production. The database stores:

- users
- conversations
- chat messages

The local SQLite file is created automatically at:

```text
chatbot.db
```

For production, set `DATABASE_URL` to a PostgreSQL URL such as:

```env
DATABASE_URL=postgresql://chatbot_user:your_password@localhost:5432/chatbot_db
```

## 8. RAG and document ingestion

The project includes a real document loading layer in `rag.py` that searches the `documents/` folder and reads supported files such as:

- `.txt`
- `.md`
- `.pdf`

This is structured to support future improvement with vector databases or semantic search.

A sample document has been added under `documents/company_overview.md` so you can test RAG immediately.

## 9. React frontend example

A minimal Vite + React app has been added in `frontend/` to demonstrate calling the backend.

Start it with:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Then open:

```text
http://localhost:5173
```

## 10. Production notes

- Keep the OpenAI key strictly server-side.
- Use environment variables for all secrets and configuration.
- Add authentication/authorization before exposing the API publicly.
- Use PostgreSQL or another managed database in a deployed environment.
- Consider rate limiting, logging, monitoring, retries, and request validation for production use.

## 11. Common commands

Start the app:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Run without reload:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open API docs:

```text
http://localhost:8000/docs
```

## License

This project is intended for internal company use and can be adapted for your own deployment environment.

