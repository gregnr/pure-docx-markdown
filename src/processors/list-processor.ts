import { List, Paragraph } from 'mdast';
import { MappedElement } from '../mapper';
import { Processor } from '../processor';

/**
 * Accumulates consecutive paragraph elements marked as
 * `ListParagraph` into a single markdown `List` element.
 */
export class ListProcessor implements Processor<MappedElement> {
  currentList: Paragraph[] = [];

  async processElement(element: MappedElement) {
    // If the element's paragraph style is marked as a list,
    // add it to the current list and exclude from the output
    // (return false)
    if (
      element.type === 'paragraph' &&
      element.data?.paragraphStyle === 'ListParagraph'
    ) {
      this.currentList.push(element);
      return false;
    }

    // If we later come across a new non-list element, this
    // indicates the end of the current list, so return the
    // current list as a single list element
    if (this.currentList.length > 0) {
      return this.flushList();
    }
  }

  // If the list still contains elements at the end of the
  // document, flush it
  async end() {
    if (this.currentList.length > 0) {
      return this.flushList();
    }
  }

  // Returns the current list as a single list element
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

    return [list];
  }
}
