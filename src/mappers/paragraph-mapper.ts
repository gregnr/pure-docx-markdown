import { Element } from '@xmldom/xmldom/lib/dom';
import { Link, Paragraph, PhrasingContent, Strong, Text } from 'mdast';
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

    const paragraphProperties = this.getParagraphProperties(element);
    const children = getChildren(element);

    const mappedChildren: PhrasingContent[] = [];

    for (const child of children) {
      const mappedChild = this.mapParagraphChild(child);

      if (mappedChild) {
        mappedChildren.push(mappedChild);
      }
    }

    const processedChildren: PhrasingContent[] = [];
    let boldNodes: PhrasingContent[] = [];

    function flushList(
      previousChild: PhrasingContent,
      nextChild?: PhrasingContent
    ) {
      let cancelBold = false;

      const firstBoldNode = boldNodes[0];
      const lastBoldNode = boldNodes[boldNodes.length - 1];

      // Add all the bold nodes as children of a strong node
      const strongNode: Strong = {
        type: 'strong',
        children: boldNodes,
      };

      // We may need to add multiple nodes, so track them here
      const newNodes: PhrasingContent[] = [strongNode];

      const previousNodeEndsWithAlphanumeric =
        previousChild &&
        previousChild.type === 'text' &&
        /[a-zA-Z0-9]/.test(previousChild.value.slice(-1));

      const firstBoldNodeStartsWithNonAlphanumeric =
        firstBoldNode.type === 'text' &&
        /[^a-zA-Z0-9]/.test(firstBoldNode.value[0]);

      const nextNodeStartsWithAlphanumeric =
        nextChild &&
        nextChild.type === 'text' &&
        /[a-zA-Z0-9]/.test(nextChild.value[0]);

      const lastBoldNodeEndsWithNonAlphanumeric =
        lastBoldNode.type === 'text' &&
        /[^a-zA-Z0-9]/.test(lastBoldNode.value.slice(-1));

      // Space at the beginning or end of a bold node is invalid.
      // We can safely fix this by moving the space before the
      // bold node (if at beginning) or after the bold node (if at end)
      if (firstBoldNode.type === 'text' && firstBoldNode.value[0] === ' ') {
        firstBoldNode.value = firstBoldNode.value.trimStart();
        newNodes.unshift({
          type: 'text',
          value: ' ',
        });
      }

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

      // If the previous non-bold node ends with an alphanumeric, then the
      // bold node must also start in an alphanumeric, otherwise the bold node invalid.
      // Same applies for the other side (end of the bold node and the start of the next node).
      else if (
        (previousNodeEndsWithAlphanumeric &&
          firstBoldNodeStartsWithNonAlphanumeric) ||
        (nextNodeStartsWithAlphanumeric && lastBoldNodeEndsWithNonAlphanumeric)
      ) {
        // This isn't a valid bold node, so our
        // best option is to strip away the bold completely
        // (add all the bold elements back as regular text nodes)
        cancelBold = true;
      }

      if (cancelBold) {
        // Add all the bold elements back as regular text nodes
        processedChildren.push(...boldNodes);
      } else {
        // Add our new bold node and any other necessary nodes
        processedChildren.push(...newNodes);
      }

      // Clear the internal bold node list
      boldNodes = [];
    }

    for (const mappedChild of mappedChildren) {
      if (
        // These are the nodes we currently track bold for
        (mappedChild.type === 'text' || mappedChild.type === 'link') &&
        // Ensure the current node is marked as bold
        mappedChild.data?.isBold &&
        // If it's a text node, make sure it's not just white space
        (mappedChild.type !== 'text' || mappedChild.value.trim() !== '')
      ) {
        boldNodes.push(mappedChild);
      } else {
        // First node before the set of bold nodes
        const previousChild = processedChildren[processedChildren.length - 1];

        // First node after the set of bold nodes
        const nextChild = mappedChild;

        // If we've reached a non-bold node and have collected 1 or more
        // bold nodes before this, wrap them in a strong node
        if (boldNodes.length > 0) {
          flushList(previousChild, nextChild);
        }

        // Don't forget to add the next non-bold node
        processedChildren.push(nextChild);
      }
    }

    const previousChild = processedChildren[processedChildren.length - 1];

    if (boldNodes.length > 0) {
      flushList(previousChild);
    }

    if (processedChildren.length === 0) {
      return;
    }

    const paragraph: Paragraph = {
      type: 'paragraph',
      children: processedChildren,
      data: paragraphProperties,
    };

    return paragraph;
  }

  mapParagraphChild(element: Element): PhrasingContent | undefined {
    const runProperties = this.getRunProperties(element);

    switch (element.nodeName) {
      case 'w:r': {
        const textNode = getChild(element, 'w:t');
        const value = textNode?.firstChild?.nodeValue;

        if (!value) {
          return;
        }

        const text: Text = {
          type: 'text',
          value,
          data: runProperties,
        };

        return text;
      }
      case 'w:hyperlink': {
        const runNode = getChild(element, 'w:r');

        if (!runNode) {
          return;
        }

        const textNode = getChild(runNode, 'w:t');
        const value = textNode?.firstChild?.nodeValue;

        if (!value) {
          return;
        }

        const childRunProperties = this.getRunProperties(runNode);
        const url = validateEmail(value) ? `mailto:${value}` : value;

        const link: Link = {
          type: 'link',
          url,
          children: [
            {
              type: 'text',
              value,
              data: childRunProperties,
            },
          ],
          data: runProperties,
        };

        return link;
      }
    }
  }

  getParagraphProperties(element: Element) {
    const paragraphPropertyNode = getChild(element, 'w:pPr');

    if (!paragraphPropertyNode) {
      return;
    }

    const runProperties = this.getRunProperties(paragraphPropertyNode);

    if (!runProperties) {
      return;
    }

    const runPropertyNode = getChild(paragraphPropertyNode, 'w:rPr');

    if (!runPropertyNode) {
      return;
    }

    const id = element.getAttribute('w14:paraId');
    const paragraphStyle =
      getChild(paragraphPropertyNode, 'w:pStyle')?.getAttribute('w:val') ??
      undefined;
    const justifyClass =
      getChild(paragraphPropertyNode, 'w:jc')?.getAttribute('w:val') ??
      undefined;

    return {
      id,
      justifyClass,
      paragraphStyle,
      ...runProperties,
    };
  }

  getRunProperties(element: Element) {
    const runPropertyNode = getChild(element, 'w:rPr');

    if (!runPropertyNode) {
      return;
    }

    const size =
      getChild(runPropertyNode, 'w:sz')?.getAttribute('w:val') ?? undefined;
    const isBold = !!getChild(runPropertyNode, 'w:b');
    const isUnderlined = !!getChild(runPropertyNode, 'w:u');

    return {
      fontSize: size ? parseInt(size, 10) : undefined,
      isBold,
      isUnderlined,
    };
  }
}
