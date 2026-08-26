/**
 * Parser wraps the web-tree-sitter WASM runtime so the rest of the core can
 * parse source without knowing about grammar files or async bootstrap. It
 * caches the initialized runtime and loaded grammars so a multi-file scan
 * pays the WASM load cost once.
 */
import { Parser, Language, type Node } from "web-tree-sitter";
import { fileURLToPath } from "node:url";

let initialized = false;
const languageCache = new Map<string, Language>();
let parser: Parser | null = null;

/** Initializes the singleton WASM runtime and parser exactly once. */
export async function initParser(): Promise<void> {
  if (initialized) {
    return;
  }
  await Parser.init();
  parser = new Parser();
  initialized = true;
}

/**
 * Parses `source` with the grammar file named `grammarFileName` and returns
 * the root syntax node. The grammar name must be one vendored under
 * `grammars/`.
 */
export async function parseSource(
  source: string,
  grammarFileName: string
): Promise<Node> {
  await initParser();
  const activeParser = parser as Parser;
  const language = await loadLanguage(grammarFileName);
  activeParser.setLanguage(language);
  const tree = activeParser.parse(source);
  if (tree === null) {
    throw new Error(
      `repo-lens: could not parse source with grammar "${grammarFileName}".`
    );
  }
  return tree.rootNode;
}

/** Loads (and caches) a vendored grammar by its filename under grammars/. */
async function loadLanguage(grammarFileName: string): Promise<Language> {
  const cached = languageCache.get(grammarFileName);
  if (cached !== undefined) {
    return cached;
  }
  const grammarPath = fileURLToPath(
    new URL(`../../grammars/${grammarFileName}`, import.meta.url)
  );
  const language = await Language.load(grammarPath);
  languageCache.set(grammarFileName, language);
  return language;
}
