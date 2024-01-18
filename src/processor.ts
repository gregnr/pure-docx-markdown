import { RootContent } from 'mdast';
import { MappedElement } from './mapper';

export interface Processor {
  start?(elements: MappedElement[]): Promise<void>;
  processElement(
    element: MappedElement
  ): Promise<RootContent | false | undefined>;
  end?(): Promise<RootContent | undefined>;
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
export async function processElements(
  intermediateElements: MappedElement[],
  processors: Processor[]
) {
  const markdownElements: RootContent[] = [];

  for (const processor of processors) {
    await processor.start?.(intermediateElements);
  }

  for (const element of intermediateElements) {
    for (const processor of processors) {
      const result = await processor.processElement(element);

      if (result === undefined) {
        continue;
      }

      if (result === false) {
        break;
      }

      markdownElements.push(result);
    }
  }

  for (const processor of processors) {
    const result = await processor.end?.();

    if (result) {
      markdownElements.push(result);
    }
  }

  return markdownElements;
}
