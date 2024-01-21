import { List, Paragraph, RootContent } from 'mdast';
import { Processor } from '../processor';

/**
 * Accumulates consecutive paragraph nodes marked as
 * `ListParagraph` into a single markdown `List` node.
 */
export class ListProcessor implements Processor<RootContent> {
  currentList: Paragraph[] = [];

  async processNode(node: RootContent) {
    // If the node's paragraph style is marked as a list,
    // add it to the current list and exclude from the output
    if (
      node.type === 'paragraph' &&
      node.data?.paragraphStyle === 'ListParagraph'
    ) {
      this.currentList.push(node);

      // Exclude from the output (exit processing loop)
      return { nodes: [], continueProcessing: false };
    }

    // If we later come across a new non-list node, this
    // indicates the end of the current list, so return the
    // current list as a single list node
    if (this.currentList.length > 0) {
      return this.flushList();
    }
  }

  // If the list still contains nodes at the end of the
  // document, flush it
  async end() {
    if (this.currentList.length > 0) {
      return this.flushList();
    }
  }

  // Returns the current list as a single list node
  // and clears it
  flushList() {
    const list: List = {
      type: 'list',
      children: this.currentList.map((item) => ({
        type: 'listItem',
        children: [item],
      })),
    };

    // Clear the internal list
    this.currentList = [];

    return { nodes: [list], continueProcessing: true };
  }
}
