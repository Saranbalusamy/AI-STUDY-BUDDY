import os
import streamlit as st
from dotenv import load_dotenv
from PyPDF2 import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from groq import Groq

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
load_dotenv()

# Support both .env (local) and Streamlit Cloud secrets
def get_secret(key: str) -> str:
    """Get secret from Streamlit secrets (cloud) or .env (local)."""
    try:
        return st.secrets[key]
    except (KeyError, FileNotFoundError):
        return os.getenv(key, "")

GROQ_API_KEY = get_secret("GROQ_API_KEY")
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
LLM_MODEL = "llama-3.3-70b-versatile"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
TOP_K = 5


# ──────────────────────────────────────────────
# Core Functions
# ──────────────────────────────────────────────
def load_pdfs(uploaded_files: list) -> str:
    """Extract text from uploaded PDF files."""
    text = ""
    for pdf in uploaded_files:
        reader = PdfReader(pdf)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def create_vector_store(text: str) -> FAISS:
    """Split text into chunks, generate embeddings, and build FAISS index."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)

    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    vector_store = FAISS.from_texts(chunks, embeddings)
    return vector_store


def answer_question(question: str, vector_store: FAISS) -> str:
    """Retrieve relevant chunks and generate an answer via Groq Llama 3."""
    # Similarity search
    docs = vector_store.similarity_search(question, k=TOP_K)
    context = "\n\n---\n\n".join(doc.page_content for doc in docs)

    # Build prompt
    system_prompt = (
        "You are a helpful study assistant. Use ONLY the following context "
        "extracted from the user's documents to answer the question. "
        "If the answer is not in the context, say: "
        "\"I couldn't find the answer in the provided documents.\"\n\n"
        f"Context:\n{context}"
    )

    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ],
        temperature=0.2,
        max_tokens=2048,
    )

    return response.choices[0].message.content


# ──────────────────────────────────────────────
# Streamlit UI
# ──────────────────────────────────────────────
def main():
    st.set_page_config(
        page_title="StudyBuddy AI",
        page_icon="📚",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    # ── Custom CSS ──
    st.markdown(
        """
        <style>
        /* Global */
        .stApp {
            background-color: #0f172a;
        }
        header[data-testid="stHeader"] {
            background-color: #0f172a;
        }
        section[data-testid="stSidebar"] {
            background-color: #1e293b;
            border-right: 1px solid #334155;
        }
        section[data-testid="stSidebar"] .stMarkdown p,
        section[data-testid="stSidebar"] .stMarkdown h1,
        section[data-testid="stSidebar"] .stMarkdown h2,
        section[data-testid="stSidebar"] .stMarkdown h3 {
            color: #f1f5f9;
        }

        /* Chat messages */
        .user-msg {
            background: #6366f1;
            color: white;
            padding: 12px 18px;
            border-radius: 18px 18px 4px 18px;
            margin: 8px 0;
            max-width: 80%;
            margin-left: auto;
            word-wrap: break-word;
        }
        .bot-msg {
            background: #1e293b;
            color: #f1f5f9;
            border: 1px solid #334155;
            padding: 12px 18px;
            border-radius: 18px 18px 18px 4px;
            margin: 8px 0;
            max-width: 80%;
            word-wrap: break-word;
        }
        .chat-container {
            display: flex;
            flex-direction: column;
        }
        .msg-row-user {
            display: flex;
            justify-content: flex-end;
        }
        .msg-row-bot {
            display: flex;
            justify-content: flex-start;
        }

        /* Status badges */
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
        }
        .status-ready {
            background: rgba(34,197,94,0.15);
            color: #22c55e;
        }
        .status-waiting {
            background: rgba(234,179,8,0.15);
            color: #eab308;
        }

        /* Hide Streamlit branding */
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        </style>
        """,
        unsafe_allow_html=True,
    )

    # ── Session state ──
    if "vector_store" not in st.session_state:
        st.session_state.vector_store = None
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []
    if "pdf_names" not in st.session_state:
        st.session_state.pdf_names = []

    # ── Sidebar ──
    with st.sidebar:
        st.markdown("## 📚 StudyBuddy AI")
        st.markdown(
            "<p style='color:#94a3b8; font-size:0.85rem; margin-top:-10px;'>"
            "AI-Powered Document Q&A</p>",
            unsafe_allow_html=True,
        )
        st.markdown("---")

        # Upload
        st.markdown(
            "<p style='color:#94a3b8; font-size:0.75rem; "
            "text-transform:uppercase; letter-spacing:1px;'>"
            "Upload Documents</p>",
            unsafe_allow_html=True,
        )
        uploaded_files = st.file_uploader(
            "Choose PDF files",
            type=["pdf"],
            accept_multiple_files=True,
            label_visibility="collapsed",
        )

        if uploaded_files:
            file_names = [f.name for f in uploaded_files]
            for name in file_names:
                st.markdown(
                    f"<span style='color:#818cf8; font-size:0.85rem;'>"
                    f"📄 {name}</span>",
                    unsafe_allow_html=True,
                )

            if st.button("⚡ Process Documents", use_container_width=True):
                with st.spinner("Extracting text & building index..."):
                    raw_text = load_pdfs(uploaded_files)
                    if raw_text.strip():
                        st.session_state.vector_store = create_vector_store(raw_text)
                        st.session_state.pdf_names = file_names
                        st.success(f"✅ {len(file_names)} document(s) processed!")
                    else:
                        st.error("Could not extract text from the uploaded PDFs.")

        st.markdown("---")

        # Status
        if st.session_state.vector_store:
            st.markdown(
                "<span class='status-badge status-ready'>● Ready to answer</span>",
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                "<span class='status-badge status-waiting'>● Waiting for documents</span>",
                unsafe_allow_html=True,
            )

        st.markdown("---")

        # Clear chat
        if st.button("🗑️ Clear Chat", use_container_width=True):
            st.session_state.chat_history = []
            st.rerun()

        # Model info
        st.markdown("---")
        st.markdown(
            "<p style='color:#64748b; font-size:0.75rem; text-align:center;'>"
            "Powered by Groq · Llama 3.3<br>"
            "Embeddings: all-MiniLM-L6-v2<br>"
            "Vector Store: FAISS</p>",
            unsafe_allow_html=True,
        )

    # ── Main area ──
    # Welcome screen
    if not st.session_state.chat_history and not st.session_state.vector_store:
        st.markdown(
            "<div style='text-align:center; padding:80px 20px;'>"
            "<p style='font-size:3rem;'>📚</p>"
            "<h2 style='color:#f1f5f9;'>Welcome to StudyBuddy AI</h2>"
            "<p style='color:#94a3b8; max-width:500px; margin:auto;'>"
            "Upload your study materials in the sidebar, process them, "
            "then ask questions below. I'll find answers from your documents!"
            "</p></div>",
            unsafe_allow_html=True,
        )

    # Chat history
    if st.session_state.chat_history:
        st.markdown("<div class='chat-container'>", unsafe_allow_html=True)
        for msg in st.session_state.chat_history:
            if msg["role"] == "user":
                st.markdown(
                    f"<div class='msg-row-user'><div class='user-msg'>"
                    f"{msg['content']}</div></div>",
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f"<div class='msg-row-bot'><div class='bot-msg'>"
                    f"{msg['content']}</div></div>",
                    unsafe_allow_html=True,
                )
        st.markdown("</div>", unsafe_allow_html=True)

    # Input
    st.markdown("<div style='height: 20px'></div>", unsafe_allow_html=True)
    question = st.chat_input("Ask a question about your documents...")

    if question:
        if not GROQ_API_KEY:
            st.error("⚠️ GROQ_API_KEY not found. Please add it to your .env file.")
            return

        if not st.session_state.vector_store:
            st.warning("📤 Please upload and process documents first.")
            return

        # Add user message
        st.session_state.chat_history.append(
            {"role": "user", "content": question}
        )

        # Generate answer
        with st.spinner("Thinking..."):
            try:
                response = answer_question(question, st.session_state.vector_store)
                st.session_state.chat_history.append(
                    {"role": "assistant", "content": response}
                )
            except Exception as e:
                error_msg = f"Error: {str(e)}"
                st.session_state.chat_history.append(
                    {"role": "assistant", "content": error_msg}
                )

        st.rerun()


if __name__ == "__main__":
    main()
