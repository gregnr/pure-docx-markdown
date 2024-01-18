import {
  Heading,
  Link,
  List,
  Paragraph,
  PhrasingContent,
  RootContent,
  Text,
} from 'mdast';
import { getChild, getChildren } from './docx';
import { shallowCompare, validateEmail } from './util';

export type MappedElement = NonNullable<ReturnType<typeof mapDocxElement>>;

export interface Processor {
  start?(elements: MappedElement[]): Promise<void>;
  processElement(
    element: MappedElement
  ): Promise<RootContent | false | undefined>;
  end?(): Promise<RootContent | undefined>;
}

/**
 * Accumulates paragraph elements marked as `ListParagraph`
 * into a single markdown `List` element.
 */
export class ListItemProcessor implements Processor {
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

    return list;
  }
}

export class HeadingProcessor implements Processor {
  styles: any;

  async start(elements: MappedElement[]) {
    this.styles = this.predictStyles(elements);
  }

  async processElement(element: MappedElement) {
    if (this.styles.h1Style.matches.includes(element)) {
      const heading: Heading = {
        type: 'heading',
        depth: 1,
        children: element.children,
      };
      return heading;
    } else if (this.styles.h2Style.matches.includes(element)) {
      const heading: Heading = {
        type: 'heading',
        depth: 2,
        children: element.children,
      };
      return heading;
    }
  }

  predictStyles(paragraphChildren: Paragraph[]) {
    type Style = {
      fontSize?: number;
      isBold: boolean;
      isUnderlined: boolean;
      justifyClass?: string;
      matches: Paragraph[];
    };

    const uniqueStyles = paragraphChildren.reduce<Style[]>(
      (styles, paragraph) => {
        const metadata = paragraph.data;

        if (!metadata) {
          return styles;
        }

        const match = styles.find((style) =>
          shallowCompare(metadata, style, [
            'fontSize',
            'isBold',
            'isUnderlined',
            'justifyClass',
          ])
        );

        if (!match) {
          const { fontSize, isBold, isUnderlined, justifyClass } = metadata;
          const currentStyle = { fontSize, isBold, isUnderlined, justifyClass };

          return [...styles, { ...currentStyle, matches: [paragraph] }];
        }

        match.matches.push(paragraph);

        return styles;
      },
      []
    );

    type ArrayElement<A> = A extends readonly (infer T)[] ? T : never;

    let withScores = uniqueStyles.map((style) => {
      const otherStyles = uniqueStyles.filter((s) => s !== style);

      const scores = {
        title: 0,
        heading: 0,
        paragraph: 0,
      };

      // If it has the largest font size, it could be a title or heading style
      if (
        style.fontSize &&
        otherStyles.every(
          (otherStyle) =>
            !otherStyle.fontSize || otherStyle.fontSize < style.fontSize!
        )
      ) {
        scores.title++;
        scores.heading++;
      }

      // If it has the smallest font size, it could be a paragraph style
      if (
        style.fontSize &&
        otherStyles.every(
          (otherStyle) =>
            !otherStyle.fontSize || otherStyle.fontSize > style.fontSize!
        )
      ) {
        scores.paragraph++;
      }

      if (style.isBold) {
        scores.title++;
        scores.heading++;
      } else {
        scores.paragraph++;
      }

      if (style.isUnderlined) {
        scores.title++;
        scores.heading++;
      } else {
        scores.paragraph++;
      }

      if (style.justifyClass === 'center') {
        scores.title++;
        scores.heading++;
      } else {
        scores.paragraph++;
      }

      // If it has the most matches, it could be a paragraph style
      if (
        otherStyles.every(
          (otherStyle) => otherStyle.matches.length < style.matches.length
        )
      ) {
        scores.paragraph += 2;
      }

      if (style.matches.length === 1) {
        scores.title++;
      }

      // If it has the least matches, it could be a heading
      if (
        otherStyles.every(
          (otherStyle) => otherStyle.matches.length > style.matches.length
        )
      ) {
        scores.heading++;
      }

      const wordCounts = style.matches
        .map((paragraph) => {
          const [child] = paragraph.children;

          if (child.type === 'text') {
            const { value } = child;

            if (!value) {
              return;
            }

            const words = value.split(' ');

            return words.length;
          }
        })
        .filter((count): count is number => count !== undefined);

      const averageWordCount = wordCounts.reduce(
        (sum, count) => sum + count,
        0
      );

      if (averageWordCount < 10) {
        scores.title++;
        scores.heading++;
      }

      return {
        style,
        scores,
      };
    });

    type WithScore = ArrayElement<typeof withScores>;

    const { style: paragraphStyle } = withScores.reduce((top, current) =>
      top
        ? current.scores.paragraph > top.scores.paragraph
          ? current
          : top
        : current
    );

    withScores = withScores.filter(
      ({ style, scores }) =>
        style !== paragraphStyle && scores.paragraph >= scores.heading
    );

    const { style: h1Style } = withScores.reduce((top, current) =>
      top ? (current.scores.title > top.scores.title ? current : top) : current
    );

    withScores = withScores.filter(
      ({ style, scores }) => style !== h1Style && scores.title >= scores.heading
    );

    const { style: h2Style } = withScores.reduce((top, current) =>
      top
        ? current.scores.heading > top.scores.heading
          ? current
          : top
        : current
    );

    return {
      paragraphStyle,
      h1Style,
      h2Style,
    };
  }
}

export class PassthroughProcessor implements Processor {
  async processElement(element: MappedElement) {
    return element;
  }
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
      break;
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

/**
 * Maps a list of `docx` elements 1-to-1 to intermediate markdown elements.
 * Excludes unknown elements and elements with no children.
 *
 * Retains `docx` style and type metadata for each element that can be used
 * in future processing.
 *
 * Does not perform any additional processing, such as combining multiple
 * `docx` list paragraphs into a single markdown list item.
 */
export function mapElements(elements: Element[]) {
  return elements.reduce<MappedElement[]>((acc, element) => {
    const markdownElement = mapDocxElement(element);

    if (markdownElement && markdownElement.children.length > 0) {
      return [...acc, markdownElement];
    }

    return acc;
  }, []);
}

/**
 * Maps a `docx` element 1-to-1 to an intermediate markdown element.
 * Retains `docx` style and type metadata that can be used in future processing.
 *
 * Does not perform any additional processing, such as combining multiple
 * `docx` list paragraphs into a single markdown list item.
 */
export function mapDocxElement(element: Element) {
  switch (element.nodeName) {
    case 'w:p':
      return mapParagraphElement(element);
  }
}

export function mapParagraphElement(element: Element) {
  const metadata = getParagraphMetadata(element);
  const childNodes = getChildren(element);

  const children = childNodes.reduce<PhrasingContent[]>((acc, element) => {
    const child = mapParagraphChild(element);

    if (!child) {
      return acc;
    }

    return [...acc, child];
  }, []);

  const paragraph: Paragraph = {
    type: 'paragraph',
    children,
    data: metadata,
  };

  return paragraph;
}

export function getParagraphMetadata(element: Element) {
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
    getChild(paragraphPropertyNode, 'w:jc')?.getAttribute('w:val') ?? undefined;

  return {
    id,
    fontSize: runSize ? parseInt(runSize, 10) : undefined,
    isBold,
    isUnderlined,
    justifyClass,
    paragraphStyle,
  };
}

export function mapParagraphChild(
  element: Element
): PhrasingContent | undefined {
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
