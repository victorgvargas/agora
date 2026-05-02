"use client";

import { useRef, useState } from "react";

interface Citation {
  marker: number;
  bookTitle: string;
  bookAuthor: string;
  ordinal: number;
  chunkId: number;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export function ChatPanel({ topicId }: { topicId: number }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
    const outgoing: Msg[] = [
      ...messages,
      { role: "user", content: question },
      { role: "assistant", content: "", citations: [] },
    ];
    setMessages(outgoing);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          messages: outgoing
            .filter((m) => m.content.length > 0 || m.role === "user")
            .slice(0, -1) // strip empty assistant placeholder
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE event blocks.
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const eventLine = rawEvent
            .split("\n")
            .find((l) => l.startsWith("event: "));
          const dataLine = rawEvent
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(7);
          const payload = JSON.parse(dataLine.slice(6));

          setMessages((prev) => {
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (!last || last.role !== "assistant") return prev;
            if (event === "citations") {
              copy[copy.length - 1] = { ...last, citations: payload };
            } else if (event === "token") {
              copy[copy.length - 1] = {
                ...last,
                content: last.content + payload,
              };
            }
            return copy;
          });
          if (event === "error") {
            setMessages((prev) => {
              const copy = prev.slice();
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content:
                    last.content ||
                    "Sorry — the model call failed. Please try again.",
                };
              }
              return copy;
            });
          }
        }
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.content === "") {
          copy[copy.length - 1] = {
            ...last,
            content: "Sorry — something went wrong. Please try again.",
          };
        }
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-[70vh] rounded-lg border border-stone-200 bg-white shadow-sm">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 flex flex-col gap-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-stone-500 italic">
            Ask a question about this topic. The bot will ground its answers in
            the bibliography above and cite the passages it draws from.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} msg={m} />
        ))}
      </div>
      <form
        className="border-t border-stone-200 p-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          placeholder="What would you like to ask?"
          className="flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={streaming || input.trim().length === 0}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-stone-50 hover:bg-stone-800 disabled:opacity-50"
        >
          {streaming ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-stone-900 text-stone-50"
            : "bg-stone-100 text-stone-900"
        }`}
      >
        {msg.content || (msg.role === "assistant" ? "…" : "")}
      </div>
      {!isUser && msg.citations && msg.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {msg.citations.map((c) => (
            <span
              key={c.marker}
              title={`${c.bookTitle} — ${c.bookAuthor}`}
              className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900"
            >
              [{c.marker}] {c.bookTitle} §{c.ordinal}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
