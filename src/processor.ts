export type ProcessResult<T> = {
  nodes: T[];
  continueProcessing: boolean;
};

export interface Processor<T> {
  start?(nodes: T[]): Promise<void>;
  processNode(
    node: T,
    index: number,
    nodes: T[]
  ): Promise<ProcessResult<T> | undefined>;
  end?(nodes: T[]): Promise<ProcessResult<T> | undefined>;
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

      if (!result) {
        continue;
      }

      const { nodes: returnedNodes, continueProcessing } = result;

      processedNodes.push(...returnedNodes);

      if (!continueProcessing) {
        break;
      }
    }
  }

  for (const processor of processors) {
    const result = await processor.end?.(processedNodes);

    if (!result) {
      continue;
    }

    const { nodes: returnedNodes, continueProcessing } = result;

    processedNodes.push(...returnedNodes);

    if (!continueProcessing) {
      break;
    }
  }

  return processedNodes;
}
