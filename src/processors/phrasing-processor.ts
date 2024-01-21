import { PhrasingContent, RootContent } from 'mdast';
import { Processor, processNodes } from '../processor';

export class PhrasingProcessor implements Processor<RootContent> {
  constructor(public processors: Processor<PhrasingContent>[]) {}

  async processNode(node: RootContent) {
    if (node.type !== 'paragraph') {
      return;
    }

    // Create a sub-processor for paragraph children (phrasing content)
    const processedChildren = await processNodes(
      node.children,
      this.processors
    );

    node.children = processedChildren;

    // We only modify the children, not the outer node itself
    return undefined;
  }
}
