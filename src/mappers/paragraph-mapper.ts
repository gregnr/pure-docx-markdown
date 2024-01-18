import { Element } from '@xmldom/xmldom/lib/dom';
import { Link, Paragraph, PhrasingContent, Text } from 'mdast';
import { getChild, getChildren } from '../docx';
import { Mapper } from '../mapper';
import { validateEmail } from '../util';

/**
 * Maps a `docx` paragraph element to a markdown paragraph node.
 *
 * Retains `docx` style and type metadata for each element that can be used
 * in future processing.
 */
export class ParagraphMapper implements Mapper {
  async mapElement(element: Element) {
    if (element.nodeName !== 'w:p') {
      return;
    }

    const metadata = this.getParagraphMetadata(element);
    const children = getChildren(element);

    const mappedChildren: PhrasingContent[] = [];

    for (const child of children) {
      const mappedChild = this.mapParagraphChild(child);

      if (mappedChild) {
        mappedChildren.push(mappedChild);
      }
    }

    if (mappedChildren.length === 0) {
      return;
    }

    const paragraph: Paragraph = {
      type: 'paragraph',
      children: mappedChildren,
      data: metadata,
    };

    return paragraph;
  }

  mapParagraphChild(element: Element): PhrasingContent | undefined {
    switch (element.nodeName) {
      case 'w:r': {
        const textNode = getChild(element, 'w:t');
        const value = textNode?.firstChild?.nodeValue!;

        const text: Text = {
          type: 'text',
          value,
        };

        return text;
      }
      case 'w:hyperlink': {
        const runNode = getChild(element, 'w:r');

        if (!runNode) {
          return;
        }

        const textNode = getChild(runNode, 'w:t');
        const value = textNode?.firstChild?.nodeValue!;
        const url = validateEmail(value) ? `mailto:${value}` : value;

        const link: Link = {
          type: 'link',
          url,
          children: [
            {
              type: 'text',
              value,
            },
          ],
        };

        return link;
      }
    }
  }

  getParagraphMetadata(element: Element) {
    const paragraphPropertyNode = getChild(element, 'w:pPr');

    if (!paragraphPropertyNode) {
      return;
    }

    const runPropertyNode = getChild(paragraphPropertyNode, 'w:rPr');

    if (!runPropertyNode) {
      return;
    }

    const id = element.getAttribute('w14:paraId');
    const runSize =
      getChild(runPropertyNode, 'w:sz')?.getAttribute('w:val') ?? undefined;
    const isBold = !!getChild(runPropertyNode, 'w:b');
    const isUnderlined = !!getChild(runPropertyNode, 'w:u');
    const paragraphStyle =
      getChild(paragraphPropertyNode, 'w:pStyle')?.getAttribute('w:val') ??
      undefined;
    const justifyClass =
      getChild(paragraphPropertyNode, 'w:jc')?.getAttribute('w:val') ??
      undefined;

    return {
      id,
      fontSize: runSize ? parseInt(runSize, 10) : undefined,
      isBold,
      isUnderlined,
      justifyClass,
      paragraphStyle,
    };
  }
}
