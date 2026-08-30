"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";

const HOLD_MS = 1900;
const TYPE_MS = 70;
const DELETE_MS = 42;

export function Typewriter({ words }: { words: string[] }) {
  const reducedMotion = useReducedMotion();
  const [text, setText] = React.useState(words[0]);
  const [wordIndex, setWordIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<"holding" | "deleting" | "typing">("holding");

  React.useEffect(() => {
    if (reducedMotion) return;
    const word = words[wordIndex];
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "holding") {
      timer = setTimeout(() => setPhase("deleting"), HOLD_MS);
    } else if (phase === "deleting") {
      timer = setTimeout(() => {
        if (text.length > 0) setText(text.slice(0, -1));
        else { setWordIndex((wordIndex + 1) % words.length); setPhase("typing"); }
      }, DELETE_MS);
    } else {
      timer = setTimeout(() => {
        if (text.length < word.length) setText(word.slice(0, text.length + 1));
        else setPhase("holding");
      }, TYPE_MS);
    }
    return () => clearTimeout(timer);
  }, [reducedMotion, words, wordIndex, phase, text]);

  return (
    <span className="typewriter" aria-label={words[0]}>
      <span aria-hidden="true">{text}</span>
      <i className="type-caret" aria-hidden="true" />
    </span>
  );
}
