export interface Processor<T> {
  start?(nodes: T[]): Promise<void>;
  processNode(
    node: T,
    index: number,
    nodes: T[]
  ): Promise<T[] | false | undefined>;
  end?(nodes: T[]): Promise<T[] | undefined>;
}

/**
 * Processes intermediate nodes into final markdown nodes.
 */
export async function processNodes<T>(nodes: T[], processors: Processor<T>[]) {
  const processedNodes: T[] = [];

  for (const processor of processors) {
    await processor.start?.(nodes);
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    for (const processor of processors) {
      const result = await processor.processNode(node, i, nodes);

      if (result === undefined) {
        continue;
      }

      if (result === false) {
        break;
      }

      processedNodes.push(...result);
    }
  }

  for (const processor of processors) {
    const result = await processor.end?.(processedNodes);

    if (result) {
      processedNodes.push(...result);
    }
  }

  return processedNodes;
}
