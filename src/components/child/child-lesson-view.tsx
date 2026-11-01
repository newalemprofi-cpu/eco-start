"use client";

import * as React from "react";
import type { LessonContent } from "@/db/repo/lessons";
import { cn } from "@/lib/utils";

const STEP_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

/**
 * The child-facing rendering of a published lesson — also embedded in
 * the teacher's lesson page as a "this is what children see" preview,
 * so both always match. Built for children who can't read yet: big
 * tap targets, emoji markers, one idea per card, and a quiz that only
 * needs a tap (wrong answers just wobble — no score, no penalty).
 */
export function ChildLessonView({ topic, content }: { topic: string; content: LessonContent }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-3xl bg-module-research/15 p-4">
        <span className="text-5xl" aria-hidden>
          🌿
        </span>
        <h2 className="font-heading text-2xl font-extrabold">{topic}</h2>
      </div>

      {content.plan.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-heading text-lg font-bold">
            <span aria-hidden>👩‍🏫</span> Тәрбиешімен бірге
          </p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {content.plan.map((step, i) => (
              <li key={i} className="flex items-start gap-3 rounded-2xl border-2 border-border/60 bg-card p-4 text-base">
                <span className="text-3xl leading-none" aria-hidden>
                  {STEP_EMOJI[i] ?? "⭐"}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {content.quiz.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 font-heading text-lg font-bold">
            <span aria-hidden>❓</span> Ойлан да, бас!
          </p>
          {content.quiz.map((q, i) => (
            <QuizCard key={i} question={q.question} options={q.options} correctIndex={q.correctIndex} />
          ))}
        </div>
      )}

      {content.homeworkTip && (
        <div className="flex items-start gap-3 rounded-3xl bg-module-family/15 p-4 text-base">
          <span className="text-4xl leading-none" aria-hidden>
            🏠
          </span>
          <div>
            <p className="font-heading font-bold">Үйде ата-анаммен</p>
            <p>{content.homeworkTip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizCard({ question, options, correctIndex }: { question: string; options: string[]; correctIndex: number }) {
  const [picked, setPicked] = React.useState<number | null>(null);
  const solved = picked === correctIndex;

  return (
    <div className="rounded-3xl border-2 border-border/60 bg-card p-4">
      <p className="text-lg font-semibold">{question}</p>
      <div className={cn("mt-3 grid gap-2", options.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
        {options.map((opt, j) => {
          const isPicked = picked === j;
          const isRight = j === correctIndex;
          return (
            <button
              key={j}
              type="button"
              disabled={solved}
              onClick={() => setPicked(j)}
              className={cn(
                "min-h-16 rounded-2xl border-4 px-4 py-3 text-lg font-bold transition active:scale-95",
                isPicked && isRight && "border-success bg-success/15",
                isPicked && !isRight && "animate-[wiggle_0.4s_ease-in-out] border-warning bg-warning/10",
                !isPicked && "border-border/60 bg-background",
                solved && !isPicked && "opacity-50"
              )}
            >
              {isPicked && (isRight ? "✅ " : "🤔 ")}
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="mt-2 text-center text-2xl" aria-live="polite">
          {solved ? "🎉 Жарайсың!" : "🙂 Тағы байқап көр!"}
        </p>
      )}
    </div>
  );
}
