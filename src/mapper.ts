import { Element } from '@xmldom/xmldom/lib/dom';
import { RootContent } from 'mdast';

export type MappedElement = RootContent;

export interface Mapper {
  mapElement(element: Element): Promise<MappedElement | undefined>;
}

/**
 * Maps a list of `docx` elements 1-to-1 to intermediate markdown elements.
 * Excludes unknown elements and elements with no children.
 *
 * Does not perform any additional processing, such as combining multiple
 * `docx` list paragraphs into a single markdown list item.
 */
export async function mapElements(elements: Element[], mappers: Mapper[]) {
  const mappedElements: MappedElement[] = [];

  for (const element of elements) {
    for (const mapper of mappers) {
      const result = await mapper.mapElement(element);

      if (result) {
        mappedElements.push(result);
        break;
      }
    }
  }

  return mappedElements;
}
