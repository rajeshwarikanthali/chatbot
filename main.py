from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.orm import Session

from database import create_conversation, get_conversation_by_id, get_db, get_or_create_user, get_recent_messages, save_message
from openai_service import OpenAIService
from rag import RAGService
from tools import ToolRegistry


class Settings(BaseSettings):
    app_name: str = " Chatbot "
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    database_url: str = "sqlite:///./chatbot.db"
    rag_documents_path: str = "documents"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000"
    enable_mock_fallback: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
openai_service = OpenAIService(settings.openai_api_key, settings.openai_model)
rag_service = RAGService(settings.rag_documents_path)
tool_registry = ToolRegistry()


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=1, max_length=8000)
    conversation_id: str | None = Field(default=None, min_length=1, max_length=128)
    user_id: str | None = Field(default=None, min_length=1, max_length=128)
    user_name: str = Field(default="User", min_length=1, max_length=128)


class ChatResponse(BaseModel):
    conversation_id: str
    response: str
    model: str
    user_id: str
    tool_status: str = "ready"


app = FastAPI(
    title=settings.app_name,
    description="Production-ready backend for a ChatGPT-style AI chatbot.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    from database import init_db

    init_db()


@app.get("/health")
def health_check() -> dict[str, str]:
    mode = "live-openai" if openai_service.has_valid_api_key() else "local-demo-rag"
    return {"status": "ok", "service": settings.app_name, "environment_mode": mode}


@app.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    use_live_openai = openai_service.has_valid_api_key()

    if not use_live_openai and not settings.enable_mock_fallback:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY is not configured. Add your key to the .env file before calling /chat.",
        )

    if payload.conversation_id:
        conversation = get_conversation_by_id(db, payload.conversation_id)
        if conversation is None:
            user = get_or_create_user(db, user_id=payload.user_id, name=payload.user_name)
            conversation = create_conversation(db, user_id=user.id, title=payload.message[:40].strip() or "New conversation")
        else:
            if payload.user_id:
                user = get_or_create_user(db, user_id=payload.user_id, name=payload.user_name)
                if conversation.user_id != user.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="This conversation belongs to a different user.",
                    )
            else:
                user = conversation.user
    else:
        user = get_or_create_user(db, user_id=payload.user_id, name=payload.user_name)
        conversation = create_conversation(db, user_id=user.id, title=payload.message[:40].strip() or "New conversation")

    save_message(db, conversation.id, "user", payload.message)

    history = get_recent_messages(db, conversation.id, limit=20)
    system_prompt = rag_service.build_system_prompt(payload.message)
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

    for message in history:
        if message.role in {"user", "assistant"}:
            messages.append({"role": message.role, "content": message.content})

    model_used = settings.openai_model
    if use_live_openai:
        try:
            assistant_response = await openai_service.generate_chat_completion(messages)
        except Exception as exc:
            if settings.enable_mock_fallback:
                raw_context = rag_service.get_relevant_context(payload.message)
                assistant_response = openai_service.generate_fallback_response(messages, rag_context=raw_context)
                model_used = f"{settings.openai_model}-fallback"
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"AI response generation failed: {exc}",
                ) from exc
    else:
        raw_context = rag_service.get_relevant_context(payload.message)
        assistant_response = openai_service.generate_fallback_response(messages, rag_context=raw_context)
        model_used = "local-rag-assistant"

    save_message(db, conversation.id, "assistant", assistant_response)

    return ChatResponse(
        conversation_id=conversation.id,
        response=assistant_response,
        model=model_used,
        user_id=user.id,
        tool_status="ready" if tool_registry.available_tools() else "empty",
    )


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Welcome to the Company AI Chatbot API."}

