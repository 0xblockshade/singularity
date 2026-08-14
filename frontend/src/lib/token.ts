/** The token attached to this record.
 *
 * Set TOKEN_MINT to "" to hide the contract line everywhere — the footer renders
 * nothing rather than an empty box, so pulling the token is a one-line change.
 */
export const TOKEN_MINT = "LoopescUsDgo6cVAc7vQLvBBV9cNSZcRsa4216HTEVP";

export const TOKEN_SYMBOL = "$LOOP";

export function explorerUrl(mint: string): string {
  return `https://solscan.io/token/${mint}`;
}

/** Middle-truncate for narrow screens: first 6 and last 6 characters. */
export function shortMint(mint: string): string {
  return mint.length <= 16 ? mint : `${mint.slice(0, 6)}…${mint.slice(-6)}`;
}
