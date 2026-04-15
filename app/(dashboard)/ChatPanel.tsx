"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function ChatPanel(): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const message = input.trim();
    if (!message || streaming) return;

    setInput("");
    const history = messages.slice(-20);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: "Something went wrong. Please try again." };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text } = JSON.parse(data) as { text: string };
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                role: "assistant",
                content: next[next.length - 1].content + text,
              };
              return next;
            });
          } catch {
            // malformed chunk, skip
          }
        }
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="bg-gray-900 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold text-lg">Ask about your day</h2>

      <div className="h-64 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Ask a question about your GitHub activity, calendar, or tasks.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-900/50 text-indigo-100 ml-auto"
                  : "bg-gray-800 text-gray-200"
              }`}
            >
              {m.content}
              {m.role === "assistant" && m.content === "" && (
                <span className="animate-pulse">▍</span>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What did I work on yesterday?"
          disabled={streaming}
          className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}
