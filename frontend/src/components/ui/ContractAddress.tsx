import { useEffect, useRef, useState } from "react";
import { TOKEN_MINT, TOKEN_SYMBOL, explorerUrl, shortMint } from "@/lib/token";

/** The contract address, with copy-to-clipboard and an explorer link.
 *
 * Deliberately quiet: this sits under the colophon line, not in the header. The
 * record is the product; the token is a footnote to it.
 */
export function ContractAddress() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!TOKEN_MINT) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(TOKEN_MINT);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is unavailable on insecure origins or when the user denies it.
      // The address stays selectable, so failing quietly is better than an alert.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
      {/* The token shares the record's name, so "Singularity contract" would stutter. */}
      <span className="font-medium text-muted">Contract</span>

      <button
        type="button"
        onClick={copy}
        title={TOKEN_MINT}
        aria-label={`Copy the ${TOKEN_SYMBOL} contract address`}
        className="focusable group inline-flex items-center gap-2 rounded-sm border border-line px-2 py-1 font-mono text-faint transition-colors hover:border-muted hover:text-ink"
      >
        <span className="sm:hidden">{shortMint(TOKEN_MINT)}</span>
        <span className="hidden select-all sm:inline">{TOKEN_MINT}</span>
        <span
          aria-hidden="true"
          className="text-[10px] uppercase tracking-wide text-muted transition-colors group-hover:text-signal"
        >
          {copied ? "copied" : "copy"}
        </span>
      </button>

      <span aria-live="polite" className="sr-only">
        {copied ? "Contract address copied to clipboard" : ""}
      </span>

      <a
        href={explorerUrl(TOKEN_MINT)}
        target="_blank"
        rel="noopener noreferrer"
        className="focusable rounded-sm text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
      >
        View on Solscan
      </a>
    </div>
  );
}
