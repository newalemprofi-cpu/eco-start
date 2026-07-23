"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send, Sparkles } from "lucide-react";
import { sendChildChatMessage } from "@/app/[locale]/app/child/chat/actions";
import type { ChatMessageRow } from "@/db/repo/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SUGGESTED_KEYS = {
  kk: ["Неге аспан көк?", "Ара қалай бал жасайды?", "Су қайдан келеді?"],
  ru: ["Почему небо голубое?", "Как пчёлы делают мёд?", "Откуда берётся вода?"],
  en: ["Why is the sky blue?", "How do bees make honey?", "Where does water come from?"],
} as const;

type Locale = keyof typeof SUGGESTED_KEYS;

export function NatureChat({
  locale,
  threadId,
  initialMessages,
}: {
  locale: Locale;
  threadId: string;
  initialMessages: ChatMessageRow[];
}) {
  const t = useTranslations("chat");
  const [messages, setMessages] = React.useState(initialMessages);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // A monotonic counter, not Date.now()/Math.random(), for locally-
  // generated optimistic message ids — those impure globals aren't
  // allowed inside component logic under the React Compiler's purity
  // rule, even in an event-triggered async function.
  const localIdRef = React.useRef(0);
  function nextLocalId(suffix: string) {
    localIdRef.current += 1;
    return `local-${localIdRef.current}-${suffix}`;
  }

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setPending(true);
    const userMsg: ChatMessageRow = {
      id: nextLocalId("u"),
      sender: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    const history = messages.map((m) => ({
      role: (m.sender === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    }));

    const res = await sendChildChatMessage(locale, threadId, history, message);
    setPending(false);

    if (res.ok) {
      setMessages((m) => [
        ...m,
        { id: nextLocalId("a"), sender: "assistant", content: res.reply, createdAt: new Date().toISOString() },
      ]);
    } else {
      setMessages((m) => [
        ...m,
        {
          id: nextLocalId("e"),
          sender: "assistant",
          content: res.error === "rate_limited" ? "⏳" : "⚠️",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-border/60 bg-card shadow-sm">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-8">
            {SUGGESTED_KEYS[locale].map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                m.sender === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("thinking")}
          </div>
        )}
      </div>
      <div className="border-t border-border/60 p-3">
        {messages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTED_KEYS[locale].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                disabled={pending}
                className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" />
          {t("safetyNote")}
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("placeholder")}
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !input.trim()} size="icon" aria-label={t("send")}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
