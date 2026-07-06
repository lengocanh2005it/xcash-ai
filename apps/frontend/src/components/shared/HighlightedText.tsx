import { Fragment, type ReactNode } from 'react';

// Keyword nghiệp vụ để AI tự highlight qua **...** trong system prompt.
// Chỉ giữ pattern deterministic ở FE — số tiền, %, ngày, mã TK.
type TokenType = 'money' | 'percent' | 'date' | 'account';

interface Token {
  start: number;
  end: number;
  type: TokenType;
  text: string;
}

const PATTERNS: { type: TokenType; re: RegExp }[] = [
  { type: 'account', re: /(?:Nợ|Có)\s+\d{3,4}/g },
  {
    type: 'money',
    re: /\d{1,3}(?:\.\d{3})+\s*(?:đ|đồng|VNĐ|VND)?|\d+\s*(?:đ|đồng|VNĐ|VND)|\d+(?:[.,]\d+)?\s*(?:tỷ|triệu|nghìn|tr)\b/gi,
  },
  { type: 'percent', re: /\d+(?:[.,]\d+)?%/g },
  {
    type: 'date',
    re: /\btháng\s*\d{1,2}(?:\/\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/gi,
  },
];

const TOKEN_CLASS: Record<TokenType, string> = {
  money: 'font-semibold',
  percent: 'font-semibold',
  date: 'font-semibold',
  account: 'font-mono font-semibold',
};

function tokenize(text: string): Token[] {
  const found: Token[] = [];
  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null = re.exec(text);
    while (match !== null) {
      found.push({ start: match.index, end: match.index + match[0].length, type, text: match[0] });
      if (match[0].length === 0) re.lastIndex++;
      match = re.exec(text);
    }
  }

  found.sort((a, b) => a.start - b.start || b.end - a.end);

  const result: Token[] = [];
  let lastEnd = -1;
  for (const token of found) {
    if (token.start >= lastEnd) {
      result.push(token);
      lastEnd = token.end;
    }
  }
  return result;
}

function colorize(text: string, keyPrefix: string): ReactNode {
  const tokens = tokenize(text);
  if (tokens.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.start > cursor) {
      nodes.push(
        <Fragment key={`${keyPrefix}-plain-${cursor}-${token.start}`}>
          {text.slice(cursor, token.start)}
        </Fragment>,
      );
    }
    nodes.push(
      <span
        key={`${keyPrefix}-${token.type}-${token.start}-${token.end}`}
        className={TOKEN_CLASS[token.type]}
      >
        {token.text}
      </span>,
    );
    cursor = token.end;
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-tail`}>{text.slice(cursor)}</Fragment>);
  }

  return nodes;
}

const BOLD_RE = /\*\*([\s\S]+?)\*\*/g;

export function HighlightedText({ text }: { text: string }): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null = BOLD_RE.exec(text);

  while (match !== null) {
    if (match.index > cursor) {
      nodes.push(
        <Fragment key={`plain-${cursor}-${match.index}`}>
          {colorize(text.slice(cursor, match.index), `p${cursor}-${match.index}`)}
        </Fragment>,
      );
    }
    nodes.push(
      <strong key={`bold-${match.index}`} className="font-semibold">
        {colorize(match[1], `b${match.index}`)}
      </strong>,
    );
    cursor = match.index + match[0].length;
    match = BOLD_RE.exec(text);
  }

  if (cursor < text.length) {
    nodes.push(<Fragment key="plain-tail">{colorize(text.slice(cursor), 'ptail')}</Fragment>);
  }

  return nodes.length > 0 ? nodes : text;
}
