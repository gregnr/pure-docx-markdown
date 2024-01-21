import { PhrasingContent, Strong } from 'mdast';
import { Processor } from '../../processor';

/**
 * Accumulates consecutive text nodes marked as bold
 * into a single markdown `Strong` node.
 */
export class BoldProcessor implements Processor<PhrasingContent> {
  currentList: PhrasingContent[] = [];

  async processNode(
    node: PhrasingContent,
    index: number,
    nodes: PhrasingContent[]
  ) {
    if (
      // These are the nodes we currently track bold for
      (node.type === 'text' || node.type === 'link') &&
      // Ensure the current node is marked as bold
      node.data?.isBold
    ) {
      this.currentList.push(node);

      // Exclude from the output (return false)
      return false;
    }

    // If we later come across a new non-bold node, this
    // indicates the end of the current list of bold nodes,
    // so return the current list as a single `Strong` node
    if (this.currentList.length > 0) {
      const previousNode = nodes[index - 1];
      const nextNode = node;

      return this.flushList(previousNode, nextNode);
    }
  }

  /**
   * If the list still contains nodes at the end of the document, flush it
   */
  async end(nodes: PhrasingContent[]) {
    const lastNode = nodes[nodes.length - 1];

    if (this.currentList.length > 0) {
      return this.flushList(lastNode);
    }
  }

  // Returns the current bold list as a single `Strong` node
  // and clears it
  flushList(previousNode?: PhrasingContent, nextNode?: PhrasingContent) {
    try {
      const firstBoldNode = this.currentList[0];
      const lastBoldNode = this.currentList[this.currentList.length - 1];

      // Add all the bold nodes as children of a strong node
      const strongNode: Strong = {
        type: 'strong',
        children: this.currentList,
      };

      // We may need to add multiple nodes, so track them here
      const newNodes: PhrasingContent[] = [strongNode];

      // Space at the beginning of a bold node is invalid.
      // We can safely fix this by moving the space
      // before the bold node
      if (firstBoldNode.type === 'text' && firstBoldNode.value[0] === ' ') {
        firstBoldNode.value = firstBoldNode.value.trimStart();
        newNodes.unshift({
          type: 'text',
          value: ' ',
        });
      }

      // Otherwise check for a valid alphanumeric boundary
      else if (!this.validateAlphanumericStart(previousNode)) {
        // This isn't a valid bold node, so our
        // best option is to strip away the bold completely
        // (add all the bold nodes back as regular text nodes)
        return this.currentList.slice();
      }

      // Space at the end of a bold node is invalid.
      // We can safely fix this by moving the space
      // after the bold node
      if (
        lastBoldNode.type === 'text' &&
        lastBoldNode.value.slice(-1) === ' '
      ) {
        lastBoldNode.value = lastBoldNode.value.trimEnd();
        newNodes.push({
          type: 'text',
          value: ' ',
        });
      }

      // Otherwise check for a valid alphanumeric boundary
      else if (!this.validateAlphanumericEnd(nextNode)) {
        // This isn't a valid bold node, so our
        // best option is to strip away the bold completely
        // (add all the bold nodes back as regular text nodes)
        return this.currentList.slice();
      }

      // Add our new bold node and any other necessary nodes
      return newNodes;
    } finally {
      // Clear the internal bold node list
      this.currentList = [];
    }
  }

  /**
   * If the previous non-bold node ends with an alphanumeric, then the
   * bold node must also start in an alphanumeric, otherwise the bold node invalid.
   */
  validateAlphanumericStart(previousNode?: PhrasingContent) {
    const firstBoldNode = this.currentList[0];

    const previousNodeEndsWithAlphanumeric =
      previousNode &&
      previousNode.type === 'text' &&
      /[a-zA-Z0-9]/.test(previousNode.value.slice(-1));

    const firstBoldNodeStartsWithNonAlphanumeric =
      firstBoldNode.type === 'text' &&
      /[^a-zA-Z0-9]/.test(firstBoldNode.value[0]);

    return !(
      previousNodeEndsWithAlphanumeric && firstBoldNodeStartsWithNonAlphanumeric
    );
  }

  /**
   * If the next non-bold node starts with an alphanumeric, then the
   * bold node must also end in an alphanumeric, otherwise the bold node invalid.
   */
  validateAlphanumericEnd(nextNode?: PhrasingContent) {
    const lastBoldNode = this.currentList[this.currentList.length - 1];

    const nextNodeStartsWithAlphanumeric =
      nextNode &&
      nextNode.type === 'text' &&
      /[a-zA-Z0-9]/.test(nextNode.value[0]);

    const lastBoldNodeEndsWithNonAlphanumeric =
      lastBoldNode.type === 'text' &&
      /[^a-zA-Z0-9]/.test(lastBoldNode.value.slice(-1));

    return !(
      nextNodeStartsWithAlphanumeric && lastBoldNodeEndsWithNonAlphanumeric
    );
  }
}
