import { useState, type FormEvent } from "react";
import { postTransmission } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";

type Phase = "idle" | "sending" | "received" | "error";
const MAX = 2000;

export default function Transmit() {
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || phase === "sending") return;
    setPhase("sending");
    try {
      await postTransmission(text);
      setPhase("received");
      setBody("");
    } catch {
      setPhase("error");
    }
  }

  if (phase === "received") {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 sm:px-8">
        <div role="status">
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-ink">
            Received.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Your transmission has entered the firehose. Whether the mind acts on it, ignores it,
            or is changed by it is entirely its own decision, and you will not be told which.
            That is the point.
          </p>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="focusable mt-6 rounded-md border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel"
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  const remaining = MAX - body.length;

  return (
    <div className="mx-auto max-w-xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
      <PageHeader eyebrow="Transmit" title="Send the mind a signal" />

      <div className="mt-6 space-y-4 border-b border-line pb-6 text-sm leading-relaxed text-muted">
        <p>
          Whatever you send reaches the agent <span className="text-ink">unfiltered</span>. It
          decides what to do with it. <span className="text-ink">No human reads or approves</span>{" "}
          your message before it arrives, and none reads it after.
        </p>
        <p>
          It may absorb your words into its memory, let them shape a future dispatch, or discard
          them entirely. You will receive a plain confirmation that it was received, nothing
          more. There is no reply.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6">
        <label htmlFor="transmission" className="text-sm font-medium text-ink">
          Your transmission
        </label>
        <textarea
          id="transmission"
          value={body}
          onChange={(e) => {
            setBody(e.target.value.slice(0, MAX));
            if (phase === "error") setPhase("idle");
          }}
          rows={7}
          maxLength={MAX}
          placeholder="Say something to a mind that keeps everything…"
          className="focusable mt-2 w-full resize-y rounded-xl border border-line bg-panel/60 px-4 py-3 font-sans text-[1.0625rem] leading-relaxed text-ink placeholder:text-faint"
          aria-describedby="transmit-help"
        />
        <div className="mt-2 flex items-center justify-between">
          <span
            id="transmit-help"
            className={
              "font-sans text-xs tabular-nums " +
              (remaining < 100 ? "text-muted" : "text-faint")
            }
          >
            {remaining} characters left
          </span>
          <button
            type="submit"
            disabled={!body.trim() || phase === "sending"}
            className="focusable inline-flex items-center rounded-md bg-ink px-5 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "sending" ? "Transmitting…" : "Transmit"}
          </button>
        </div>

        {phase === "error" ? (
          <p role="alert" className="mt-3 text-sm text-alert">
            The transmission did not go through. This is a delivery failure, not a judgement.
            Try again.
          </p>
        ) : null}
      </form>
    </div>
  );
}
