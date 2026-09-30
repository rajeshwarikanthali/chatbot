from __future__ import annotations

from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional dependency for PDFs
    PdfReader = None


class RAGService:
    def __init__(self, documents_path: str = "documents") -> None:
        self.documents_path = Path(documents_path)
        self.documents: list[dict[str, str]] = []
        self.index_documents()

    def index_documents(self) -> None:
        self.documents_path.mkdir(parents=True, exist_ok=True)
        found_documents: list[dict[str, str]] = []

        for extension in ("*.txt", "*.md", "*.pdf"):
            for file_path in sorted(self.documents_path.glob(extension)):
                text = self._read_document(file_path)
                if text.strip():
                    found_documents.append({"file_name": file_path.name, "content": text})

        self.documents = found_documents

    def _read_document(self, file_path: Path) -> str:
        if file_path.suffix.lower() == ".pdf":
            return self._read_pdf(file_path)

        return file_path.read_text(encoding="utf-8", errors="ignore")

    def _read_pdf(self, file_path: Path) -> str:
        if PdfReader is None:
            return ""

        try:
            reader = PdfReader(str(file_path))
            pages: list[str] = []
            for page in reader.pages:
                text = page.extract_text() or ""
                if text:
                    pages.append(text)
            return "\n".join(pages)
        except Exception:  # pragma: no cover - PDF parsing failure should fail gracefully
            return ""

    def _chunk_text(self, text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
        cleaned = " ".join(text.split())
        chunks: list[str] = []

        for start in range(0, len(cleaned), chunk_size - overlap):
            chunk = cleaned[start:start + chunk_size]
            if chunk.strip():
                chunks.append(chunk.strip())

        return chunks or [cleaned]

    def get_relevant_context(self, query: str, limit: int = 3) -> str:
        if not self.documents:
            return ""

        query_terms = [term.lower() for term in query.split() if term]
        if not query_terms:
            return ""

        ranked: list[tuple[int, str, str]] = []

        for article in self.documents:
            content = article["content"]
            content_lower = content.lower()
            score = sum(1 for term in query_terms if term in content_lower)
            if score > 0:
                ranked.append((score, article["file_name"], content))

        ranked.sort(key=lambda item: item[0], reverse=True)
        if not ranked:
            return ""

        snippets: list[str] = []
        for _, file_name, content in ranked[:limit]:
            chunks = self._chunk_text(content)
            best_chunk = max(chunks, key=lambda entry: sum(1 for term in query_terms if term in entry.lower()))
            snippets.append(f"Source: {file_name}\n{best_chunk[:1000]}")

        return "\n\n".join(snippets)

    def build_system_prompt(self, query: str) -> str:
        context = self.get_relevant_context(query)
        if context:
            return (
                "You are a helpful AI assistant for the company. "
                "Use the supplied company document context when it is relevant. "
                "If the answer cannot be supported by the available context, say so clearly.\n\n"
                f"Relevant context:\n{context}"
            )

        return (
            "You are a helpful AI assistant for the company. "
            "No company documents were found in the configured documents folder yet, so answer from general knowledge "
            "when appropriate and be transparent when asked for internal company-specific facts."
        )

