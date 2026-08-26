#!/usr/bin/env node
/**
 * repo-lens command-line entrypoint.
 *
 * Placeholder scaffold that proves the build emits a runnable binary at
 * dist/cli.js, so the subprocess test seam and `npx repo-lens` work end to
 * end. Replaced by ticket 01 with the real argument parsing and scan
 * orchestration.
 */
import { REPO_LENS_VERSION } from "./index.js";

function printUsage(): void {
  console.log(`repo-lens ${REPO_LENS_VERSION}

Usage:
  repo-lens scan [path]   Scan a repository (not yet implemented)
  repo-lens serve [path]  Serve a report (not yet implemented)
  repo-lens mcp           Run the MCP stdio server (not yet implemented)
`);
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(REPO_LENS_VERSION);
  process.exit(0);
}

// Fail loudly with an actionable message until ticket 01 implements scanning.
console.error(
  `repo-lens: "${args.join(" ")}" is not implemented yet. ` +
    `Only --help and --version are available in this scaffold.`
);
process.exit(1);
