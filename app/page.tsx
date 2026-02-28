"use client";
import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<{ loc: string; txtPath: string }[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [indexStatus, setIndexStatus] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function createIndexAndEmbeddings() {
    setIndexStatus("Creating index and embeddings... This may take a while.");
    try {
      const result = await fetch("/api/setup", { method: "POST" });
      const json = await result.json();
      if (!result.ok || json.error) {
        setIndexStatus("Error: " + (json.error || "Setup failed."));
        return;
      }
      setIndexStatus("Index and embeddings created successfully!");
      setTimeout(() => setIndexStatus(""), 5000);
    } catch (err: any) {
      setIndexStatus("Error: " + (err.message || "Something went wrong."));
      console.log("error: ", err);
    }
  }

  async function sendQuery() {
    if (!query.trim()) return;
    const currentQuery = query;
    setSources([]);
    setResult("");
    setLoading(true);
    setQuery("");
    setHistory((old) => [...old, { role: "user", content: currentQuery }]);

    try {
      const result = await fetch("/api/read", {
        method: "POST",
        body: JSON.stringify({ query: currentQuery, history: history }),
      });
      const json = await result.json();
      setSources(json.sources || []);
      delete json.sources;
      setHistory((old) => [...old, json]);
      setResult(json.content);
    } catch (err: any) {
      const errMsg = "Error: " + (err.message || "Something went wrong.");
      setHistory((old) => [...old, { role: "assistant", content: errMsg }]);
      setResult(errMsg);
    } finally {
      setLoading(false);
    }
  }

  function clearChatHistory() {
    setHistory([]);
    setResult("");
    setSources([]);
  }

  const uploadFile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!files.length) return;
    setUploadStatus("Uploading...");
    try {
      const data = new FormData();
      for (let i = 0; i < files.length; i++) {
        data.append("files[]", files[i]);
      }
      const res = await fetch("/api/upload", { method: "POST", body: data });
      if (!res.ok) throw new Error(await res.text());
      setUploadStatus(`${files.length} file(s) uploaded successfully!`);
      setFiles([]);
      setTimeout(() => setUploadStatus(""), 4000);
    } catch (e: any) {
      setUploadStatus("Upload failed. Please try again.");
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) setFiles(Array.from(selectedFiles));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static z-30 w-72 h-full transition-transform duration-300 ease-in-out flex flex-col`}
        style={{ backgroundColor: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
      >
        {/* Sidebar Header */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: "var(--accent)" }}>
            📚
          </div>
          <div>
            <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>StudyBuddy</h1>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>AI Study Assistant</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
            Upload Documents
          </h3>
          <form onSubmit={uploadFile} className="space-y-3">
            <label
              className="flex flex-col items-center justify-center w-full h-24 rounded-lg cursor-pointer transition-colors"
              style={{ border: "2px dashed var(--border)", backgroundColor: "rgba(99,102,241,0.05)" }}
            >
              <div className="flex flex-col items-center">
                <svg className="w-6 h-6 mb-1" style={{ color: "var(--text-secondary)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {files.length ? `${files.length} file(s) selected` : "Click to upload PDF, DOCX, TXT"}
                </p>
              </div>
              <input type="file" className="hidden" onChange={handleFileChange} multiple accept=".pdf,.docx,.txt,.md" />
            </label>
            <button
              type="submit"
              disabled={!files.length}
              className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              Upload Files
            </button>
          </form>
          {uploadStatus && (
            <p className="mt-2 text-xs animate-fade-in" style={{ color: uploadStatus.includes("success") ? "var(--success)" : "var(--danger)" }}>
              {uploadStatus}
            </p>
          )}

          <div className="my-5" style={{ borderTop: "1px solid var(--border)" }} />

          {/* Setup Section */}
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
            Setup
          </h3>
          <button
            onClick={createIndexAndEmbeddings}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)", backgroundColor: "transparent" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Create Index &amp; Embeddings
          </button>
          {indexStatus && (
            <p className="mt-2 text-xs animate-fade-in" style={{ color: indexStatus.includes("success") ? "var(--success)" : indexStatus.includes("Error") ? "var(--danger)" : "var(--text-secondary)" }}>
              {indexStatus}
            </p>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={clearChatHistory}
            className="w-full py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{ border: "1px solid var(--border)", color: "var(--danger)", backgroundColor: "transparent" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Chat
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <button className="md:hidden p-1" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Chat</h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Ask questions about your study materials</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "var(--success)" }}></span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Groq · Llama 3.3</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {history.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="text-5xl mb-4">📚</div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Welcome to StudyBuddy</h2>
              <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
                Upload your study materials, create the index, then ask questions about your documents. I&apos;ll help you find answers!
              </p>
              <div className="flex gap-3 mt-6 flex-wrap justify-center">
                {["What is this document about?", "Summarize the key points", "Explain the main concepts"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setQuery(suggestion); }}
                    className="px-4 py-2 rounded-full text-xs transition-all"
                    style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", backgroundColor: "transparent" }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div className={`flex gap-3 max-w-[75%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: msg.role === "user" ? "var(--accent)" : "var(--border)" }}
                >
                  {msg.role === "user" ? "👤" : "🤖"}
                </div>
                <div
                  className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={{
                    backgroundColor: msg.role === "user" ? "var(--accent)" : "var(--bg-card)",
                    border: msg.role === "user" ? "none" : "1px solid var(--border)",
                    color: "var(--text-primary)",
                    borderTopRightRadius: msg.role === "user" ? "4px" : "16px",
                    borderTopLeftRadius: msg.role === "user" ? "16px" : "4px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-3 max-w-[75%]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: "var(--border)" }}>
                  🤖
                </div>
                <div className="px-4 py-3 rounded-2xl text-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderTopLeftRadius: "4px" }}>
                  <div className="thinking-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="animate-fade-in ml-11">
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Referenced Documents:</p>
              <div className="flex flex-wrap gap-2">
                {sources.map((source, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "var(--accent-hover)" }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {source.txtPath?.split("/").pop() || `Source ${index + 1}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              className="flex-1 py-3 px-4 rounded-xl text-sm outline-none transition-all"
              style={{
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={sendQuery}
              disabled={loading || !query.trim()}
              className="p-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
              aria-label="Send message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            Powered by Groq &amp; Llama 3.3 — Responses based on your uploaded documents
          </p>
        </div>
      </main>
    </div>
  );
}
