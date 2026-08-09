import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Dispatch body renderer. react-markdown does NOT render raw HTML unless
 * rehype-raw is added — we deliberately don't add it, so embedded HTML in a
 * dispatch is escaped, not executed. Links open in a new tab, safely.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-dispatch">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
