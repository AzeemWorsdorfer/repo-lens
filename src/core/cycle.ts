/**
 * Cycle detection over the module dependency graph using Tarjan's strongly
 * connected components. A cycle in the report is a group of modules that
 * depend on each other circularly - exactly a non-trivial SCC - so each
 * component of size > 1 becomes one cycle of its (sorted) member module ids.
 * Components and members are sorted for deterministic output.
 */
export function findCycles(
  moduleIds: readonly string[],
  depsByModule: ReadonlyMap<string, readonly string[]>
): string[][] {
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let nextIndex = 0;

  interface Frame {
    readonly node: string;
    depIndex: number;
  }

  for (const start of moduleIds) {
    if (index.has(start)) {
      continue;
    }
    const frames: Frame[] = [];
    const pushNode = (node: string): void => {
      index.set(node, nextIndex);
      lowLink.set(node, nextIndex);
      nextIndex += 1;
      stack.push(node);
      onStack.add(node);
      frames.push({ node, depIndex: 0 });
    };
    pushNode(start);
    while (frames.length > 0) {
      // The loop guard guarantees these indices are within bounds.
      const frame = frames[frames.length - 1]!;
      const dependencies = depsByModule.get(frame.node) ?? [];
      if (frame.depIndex < dependencies.length) {
        const neighbor = dependencies[frame.depIndex]!;
        frame.depIndex += 1;
        if (neighbor === frame.node) {
          continue;
        }
        if (!index.has(neighbor)) {
          pushNode(neighbor);
        } else if (onStack.has(neighbor)) {
          lowLink.set(
            frame.node,
            Math.min(lowLink.get(frame.node) ?? 0, index.get(neighbor) ?? 0)
          );
        }
      } else {
        frames.pop();
        if (frames.length > 0) {
          const parent = frames[frames.length - 1]!;
          lowLink.set(
            parent.node,
            Math.min(
              lowLink.get(parent.node) ?? 0,
              lowLink.get(frame.node) ?? 0
            )
          );
        }
        if (lowLink.get(frame.node) === index.get(frame.node)) {
          const component: string[] = [];
          let member: string;
          do {
            // stack.pop() is safe because we only pop members we pushed.
            member = stack.pop()!;
            onStack.delete(member);
            component.push(member);
          } while (member !== frame.node);
          if (component.length > 1) {
            component.sort();
            components.push(component);
          }
        }
      }
    }
  }

  components.sort(compareComponents);
  return components;
}

/** Orders cycles deterministically: by size, then member ids. */
function compareComponents(a: string[], b: string[]): number {
  if (a.length !== b.length) {
    return a.length - b.length;
  }
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left !== undefined && right !== undefined && left !== right) {
      return left.localeCompare(right);
    }
  }
  return 0;
}
