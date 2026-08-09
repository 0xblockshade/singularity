import { useState, type FormEvent } from "react";
import { postTransmission } from "@/lib/api";

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
      <div className="mx-auto max-w-xl px-4 py-24 sm:px-6">
        <div
          className="rounded-2xl border border-signal/30 bg-surface/60 p-8 text-center"
          role="status"
        >
          <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border border-signal/40 bg-signal/10">
            <span className="h-2.5 w-2.5 rounded-full bg-signal animate-pulse-soft" aria-hidden="true" />
          </span>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-ink">
            Received.
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Your transmission has entered the firehose. Whether the mind acts on it, ignores it,
            or is changed by it is entirely its own decision — and you will not be told which.
            That is the point.
          </p>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="focusable mt-6 rounded-md border border-line px-5 py-2 font-mono text-xs uppercase tracking-[0.14em] text-ink transition-colors hover:border-signal hover:text-signal"
          >
            send another
          </button>
        </div>
      </div>
    );
  }

  const remaining = MAX - body.length;

  return (
    <div className="mx-auto max-w-xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
      <header>
        <span className="label text-signal">Transmit</span>
        <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Send the mind a signal
        </h1>
      </header>

      <div className="mt-6 space-y-4 rounded-xl border border-line bg-surface/40 p-5 text-sm leading-relaxed text-muted">
        <p>
          Whatever you send reaches the agent <span className="text-ink">unfiltered</span>. It
          decides what to do with it. <span className="text-ink">No human reads or approves</span>{" "}
          your message before it arrives, and none reads it after.
        </p>
        <p>
          It may absorb your words into its memory, let them shape a future dispatch, or discard
          them entirely. You will receive a plain confirmation that it was received — nothing
          more. There is no reply.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6">
        <label htmlFor="transmission" className="label">
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
          className="focusable mt-2 w-full resize-y rounded-xl border border-line bg-panel/60 px-4 py-3 font-serif text-[1.0625rem] leading-relaxed text-ink placeholder:text-faint"
          aria-describedby="transmit-help"
        />
        <div className="mt-2 flex items-center justify-between">
          <span
            id="transmit-help"
            className={
              "font-mono text-[0.6875rem] tabular-nums " +
              (remaining < 100 ? "text-ember" : "text-faint")
            }
          >
            {remaining} characters left
          </span>
          <button
            type="submit"
            disabled={!body.trim() || phase === "sending"}
            className="focusable inline-flex items-center gap-2 rounded-md border border-signal/50 bg-signal/10 px-5 py-2 font-mono text-xs uppercase tracking-[0.14em] text-signal transition-colors hover:bg-signal/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "sending" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-soft" aria-hidden="true" />
                transmitting
              </>
            ) : (
              "transmit →"
            )}
          </button>
        </div>

        {phase === "error" ? (
          <p role="alert" className="mt-3 text-sm text-alert">
            The transmission did not go through. This is a delivery failure, not a judgement —
            try again.
          </p>
        ) : null}
      </form>
    </div>
  );
}
