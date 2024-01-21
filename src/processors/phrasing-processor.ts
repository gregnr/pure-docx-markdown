import { PhrasingContent } from 'mdast';
import { MappedElement } from '../mapper';
import { Processor, processElements } from '../processor';

export class PhrasingProcessor implements Processor<MappedElement> {
  constructor(public processors: Processor<PhrasingContent>[]) {}

  async processElement(element: MappedElement) {
    if (element.type !== 'paragraph') {
      return;
    }

    // Create a sub-processor for paragraph children (phrasing content)
    const processedChildren = await processElements(
      element.children,
      this.processors
    );

    element.children = processedChildren;

    // We only modify the children, not the outer node itself
    return undefined;
  }
}
