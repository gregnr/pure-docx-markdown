export interface Processor<T> {
  start?(elements: T[]): Promise<void>;
  processElement(
    element: T,
    index: number,
    elements: T[]
  ): Promise<T[] | false | undefined>;
  end?(elements: T[]): Promise<T[] | undefined>;
}

/**
 * Processes intermediate elements into final markdown elements.
 *
 * Performs various tasks such as:
 *
 * - Combining multiple paragraph elements that were marked as
 *   list items into a single markdown list
 *
 * - Converting paragraph elements into headings based on styles
 *   and heuristics
 */
export async function processElements<T>(
  intermediateElements: T[],
  processors: Processor<T>[]
) {
  const processedNodes: T[] = [];

  for (const processor of processors) {
    await processor.start?.(intermediateElements);
  }

  for (let i = 0; i < intermediateElements.length; i++) {
    const element = intermediateElements[i];

    for (const processor of processors) {
      const result = await processor.processElement(
        element,
        i,
        intermediateElements
      );

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
