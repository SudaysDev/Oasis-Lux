"use client";

import { Fragment, type ReactNode } from "react";

// Tiny, dependency-free Markdown renderer (builds React nodes — no innerHTML, XSS-safe).
// Supports: # / ## headings, "- " and "1." lists, **bold**, *italic*, `code`, links, blank-line paragraphs.

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // order matters: code, bold, italic, link
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={key} className="font-semibold text-fg">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else {
      const lm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (lm) nodes.push(<a key={key} href={lm[2]} className="text-accent underline">{lm[1]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${key++}`} className={list.ordered ? "ml-5 list-decimal space-y-1" : "ml-1 space-y-1"}>
        {items.map((it, idx) => (
          <li key={idx} className={list!.ordered ? "" : "flex gap-2"}>
            {!list!.ordered && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
            <span>{renderInline(it, `li${key}-${idx}`)}</span>
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet) {
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(bullet[1]!);
      continue;
    }
    if (ordered) {
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(ordered[1]!);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1]!.length;
      blocks.push(
        <p key={`h${key++}`} className={lvl === 1 ? "text-lg font-bold" : lvl === 2 ? "text-base font-bold" : "font-semibold"}>
          {renderInline(h[2]!, `h${key}`)}
        </p>,
      );
      continue;
    }
    blocks.push(<p key={`p${key++}`}>{renderInline(line, `p${key}`)}</p>);
  }
  flushList();

  return <div className="space-y-2 leading-relaxed">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
