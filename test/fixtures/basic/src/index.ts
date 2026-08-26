import { readFile } from "node:fs";
import { formatName } from "./utils";
import { add } from "./math";

export function greet(name: string): string {
  const total = add(1, 2);
  return formatName(name) + total;
}
