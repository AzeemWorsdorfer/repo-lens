/**
 * Shared AST helper for resolvers: reads the plain specifier text out of a
 * string-literal node. Both the TS/JS and Python resolvers strip the same
 * surrounding quotes from import sources, so the shape lives here once.
 */
import type { Node } from "web-tree-sitter";

const QUOTES = ['"', "'", "`"];

/**
 * Returns a string literal's content without its surrounding quotes, or null
 * when the node text is not a properly quoted literal.
 */
export function stringLiteralContent(node: Node): string | null {
  const raw = node.text;
  if (raw.length < 2) {
    return null;
  }
  const quote = raw[0];
  if (quote !== undefined && QUOTES.includes(quote) && raw.endsWith(quote)) {
    return raw.slice(1, -1);
  }
  return null;
}
