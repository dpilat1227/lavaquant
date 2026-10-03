/**
 * Tiny parser for the alpha expression language (a subset of Python expressions).
 * Records source spans so callers can point at the exact piece of text.
 */

export type Node =
  | { t: "num"; v: number; s: number; e: number }
  | { t: "name"; n: string; s: number; e: number }
  | { t: "call"; fn: string; args: Node[]; s: number; e: number; fnEnd: number }
  | { t: "bin"; op: string; l: Node; r: Node; s: number; e: number }
  | { t: "un"; op: string; x: Node; s: number; e: number };

export class ParseError extends Error {
  constructor(
    message: string,
    public start: number,
    public end: number
  ) {
    super(message);
  }
}

interface Tok {
  k: "num" | "id" | "sym" | "eof";
  v: string;
  s: number;
  e: number;
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))!;
      out.push({ k: "num", v: m[0], s: i, e: i + m[0].length });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(src.slice(i))!;
      out.push({ k: "id", v: m[0], s: i, e: i + m[0].length });
      i += m[0].length;
    } else if (c === "*" && src[i + 1] === "*") {
      out.push({ k: "sym", v: "**", s: i, e: i + 2 });
      i += 2;
    } else if ("()+-*/%,".includes(c)) {
      out.push({ k: "sym", v: c, s: i, e: i + 1 });
      i++;
    } else {
      throw new ParseError(`Unexpected character "${c}"`, i, i + 1);
    }
  }
  out.push({ k: "eof", v: "", s: src.length, e: src.length });
  return out;
}

export function parseExpression(src: string): Node {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const isSym = (v: string) => peek().k === "sym" && peek().v === v;

  function expr(): Node {
    let l = term();
    while (isSym("+") || isSym("-")) {
      const op = next().v;
      const r = term();
      l = { t: "bin", op, l, r, s: l.s, e: r.e };
    }
    return l;
  }
  function term(): Node {
    let l = factor();
    while (isSym("*") || isSym("/") || isSym("%")) {
      const op = next().v;
      const r = factor();
      l = { t: "bin", op, l, r, s: l.s, e: r.e };
    }
    return l;
  }
  function factor(): Node {
    if (isSym("-") || isSym("+")) {
      const t = next();
      const x = factor();
      return { t: "un", op: t.v, x, s: t.s, e: x.e };
    }
    return power();
  }
  function power(): Node {
    const base = primary();
    if (isSym("**")) {
      next();
      const r = factor();
      return { t: "bin", op: "**", l: base, r, s: base.s, e: r.e };
    }
    return base;
  }
  function primary(): Node {
    const t = next();
    if (t.k === "num") return { t: "num", v: parseFloat(t.v), s: t.s, e: t.e };
    if (t.k === "id") {
      if (isSym("(")) {
        const fnEnd = t.e;
        next();
        const args: Node[] = [];
        if (!isSym(")")) {
          args.push(expr());
          while (isSym(",")) {
            next();
            args.push(expr());
          }
        }
        if (!isSym(")")) throw new ParseError("Missing closing parenthesis", t.s, peek().e);
        const close = next();
        return { t: "call", fn: t.v, args, s: t.s, e: close.e, fnEnd };
      }
      return { t: "name", n: t.v, s: t.s, e: t.e };
    }
    if (t.k === "sym" && t.v === "(") {
      const inner = expr();
      if (!isSym(")")) throw new ParseError("Missing closing parenthesis", t.s, peek().e);
      const close = next();
      // keep the parentheses in the span so printed snippets look natural
      return { ...inner, s: t.s, e: close.e } as Node;
    }
    if (t.k === "eof") throw new ParseError("The expression ends too early", src.length, src.length);
    throw new ParseError(`Unexpected "${t.v}"`, t.s, t.e);
  }

  if (!src.trim()) throw new ParseError("Write an expression to begin", 0, 0);
  const root = expr();
  if (peek().k !== "eof") throw new ParseError(`Unexpected "${peek().v}"`, peek().s, peek().e);
  return root;
}

/** Visit every node, children first. */
export function walk(n: Node, fn: (n: Node) => void) {
  if (n.t === "call") n.args.forEach((a) => walk(a, fn));
  else if (n.t === "bin") {
    walk(n.l, fn);
    walk(n.r, fn);
  } else if (n.t === "un") walk(n.x, fn);
  fn(n);
}
