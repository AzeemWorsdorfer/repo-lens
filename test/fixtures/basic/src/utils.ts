import { multiply } from "./math";

export function formatName(name: string): string {
  if (name.length === 0) {
    return "anonymous";
  }
  return name.trim();
}

export function classify(value: number): string {
  return value > 0 ? "positive" : value < 0 ? "negative" : "zero";
}
