#!/usr/bin/env node
/**
 * repo-lens command-line entrypoint. A thin adapter over the analysis core:
 * it parses arguments and prints the report. No business logic lives here.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyze } from "./core/graph.js";
import { buildReport } from "./core/report.js";
import { REPO_LENS_VERSION } from "./index.js";

/** Parsed form of the scan subcommand. */
interface ScanArguments {
  readonly path: string;
  readonly emit: string;
  readonly output: string | null;
}

/** The single entrypoint used by the npm bin and the subprocess test seam. */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(REPO_LENS_VERSION);
    return;
  }

  const subcommand = argv[0];
  if (subcommand !== "scan") {
    fail(
      `"${subcommand}" is not implemented yet. Only "repo-lens scan" is ` +
        `available in this build. See "repo-lens --help".`
    );
    return;
  }

  let args: ScanArguments;
  try {
    args = parseScanArguments(argv.slice(1));
  } catch (error) {
    fail((error as Error).message);
    return;
  }

  if (args.emit !== "json") {
    fail(
      `--emit ${args.emit} is not implemented yet; only --emit json is ` +
        `available (HTML arrives in a later ticket).`
    );
    return;
  }

  const analysis = await analyze(args.path);
  const report = buildReport(analysis);
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (args.output === null) {
    process.stdout.write(json);
  } else {
    writeFileSync(args.output, json, "utf8");
  }
}

/** Parses `scan`'s arguments: an optional path plus --emit and --output. */
function parseScanArguments(argv: string[]): ScanArguments {
  let path = ".";
  let emit = "json";
  let output: string | null = null;
  let pathSet = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--emit") {
      emit = requireValue(argv, (i += 1), "--emit");
    } else if (arg === "--output") {
      output = requireValue(argv, (i += 1), "--output");
    } else if (arg.startsWith("-")) {
      throw new Error(`repo-lens: unknown option "${arg}". See --help.`);
    } else if (!pathSet) {
      path = arg;
      pathSet = true;
    } else {
      throw new Error(`repo-lens: unexpected argument "${arg}". See --help.`);
    }
  }
  return { path: resolve(path), emit, output };
}

/** Reads the value for a flag, failing loudly when it is missing. */
function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined) {
    throw new Error(`repo-lens: ${flag} requires a value.`);
  }
  return value;
}

/** Prints usage to stdout. */
function printUsage(): void {
  console.log(`repo-lens ${REPO_LENS_VERSION}

Usage:
  repo-lens scan [path] [--emit json|html] [--output <file>]  Scan a repository
  repo-lens --version                                          Print the version
  repo-lens --help                                             Show this help

Options:
  --emit <json|html>   Output format (default: json; html not yet implemented)
  --output <file>      Write the report to a file instead of stdout
`);
}

/** Prints an actionable error to stderr and exits non-zero. */
function fail(message: string): void {
  console.error(`repo-lens: ${message}`);
  process.exitCode = 1;
}

void main();
