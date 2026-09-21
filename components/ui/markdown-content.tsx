import type { ReactNode } from "react";

function safeLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function renderInline(value: string): ReactNode[] {
  const tokens = value.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g);
  return tokens.map((token, index) => {
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) {
      const href = safeLink(link[2]);
      return href ? <a className="font-medium text-pink-600 underline decoration-pink-200 underline-offset-2 hover:text-pink-500" href={href} key={`${token}-${index}`} rel="noreferrer" target="_blank">{link[1]}</a> : token;
    }
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("_") && token.endsWith("_")) return <em key={`${token}-${index}`}>{token.slice(1, -1)}</em>;
    if (token.startsWith("`") && token.endsWith("`")) return <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[.9em] text-slate-800" key={`${token}-${index}`}>{token.slice(1, -1)}</code>;
    return token;
  });
}

function isBlockStart(line: string) {
  return /^(#{1,3}\s|[-*]\s|\d+\.\s|>\s|```)/.test(line);
}

export function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100" key={`code-${index}`}><code>{code.join("\n")}</code></pre>);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const headingClass = heading[1].length === 1 ? "text-xl" : heading[1].length === 2 ? "text-lg" : "text-base";
      blocks.push(<h3 className={`${headingClass} font-semibold text-slate-950`} key={`heading-${index}`}>{renderInline(heading[2])}</h3>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) items.push(lines[index++].replace(/^[-*]\s+/, ""));
      blocks.push(<ul className="list-disc space-y-1 pl-5" key={`list-${index}`}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>)}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) items.push(lines[index++].replace(/^\d+\.\s+/, ""));
      blocks.push(<ol className="list-decimal space-y-1 pl-5" key={`ordered-${index}`}>{items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>)}</ol>);
      continue;
    }

    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) quote.push(lines[index++].slice(2));
      blocks.push(<blockquote className="border-l-2 border-pink-300 pl-4 italic text-slate-600" key={`quote-${index}`}>{quote.map((quoteLine, quoteIndex) => <span className="block" key={`${quoteLine}-${quoteIndex}`}>{renderInline(quoteLine)}</span>)}</blockquote>);
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={`paragraph-${index}`}>{paragraph.map((paragraphLine, paragraphIndex) => <span key={`${paragraphLine}-${paragraphIndex}`}>{renderInline(paragraphLine)}{paragraphIndex < paragraph.length - 1 && <br />}</span>)}</p>);
  }

  return <div className={`space-y-3 break-words text-sm leading-6 text-slate-700 ${className}`}>{blocks}</div>;
}

export function markdownToPlainText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
