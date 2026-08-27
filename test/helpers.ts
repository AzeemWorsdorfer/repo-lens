/**
 * Shared black-box test helpers: they spawn the built CLI as a subprocess
 * over fixture repos and parse the JSON report, so language test suites
 * assert behavior at the public seam without importing core internals.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import type { ReportContract } from "../src/index.js";

/** The built CLI entrypoint, compiled by the pretest build step. */
export const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

/** Spawns the built CLI and returns status/stdout/stderr. */
export function scan(fixture: string, extraArgs: string[] = []) {
  return spawnSync(
    "node",
    [CLI, "scan", fixture, "--emit", "json", ...extraArgs],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
}

/** Scans and parses the report, asserting the run succeeded. */
export function scanReport(fixture: string): ReportContract {
  const result = scan(fixture);
  expect(result.status, result.stderr).toBe(0);
  // Report-contract parsing is a trust boundary: the subprocess just emitted
  // this JSON from the same build, so casting its shape is safe here.
  return JSON.parse(result.stdout) as ReportContract;
}

/** Byte length of a fixture source file, used as ground truth for size. */
export function fileSize(fixture: string, relativePath: string): number {
  const fixtureDir = fileURLToPath(
    new URL(`./fixtures/${fixture}`, import.meta.url)
  );
  return Buffer.byteLength(
    readFileSync(join(fixtureDir, relativePath), "utf8")
  );
}
