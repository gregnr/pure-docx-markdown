import { DOMParser } from '@xmldom/xmldom';
import { Element } from '@xmldom/xmldom/lib/dom';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';

import { readFile } from 'fs/promises';
import {
  Link,
  List,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Text,
} from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';

const docxSample = await readFile('my-file.docx');

const docxBlob = new Blob([docxSample], {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

const zipFileReader = new BlobReader(docxBlob);

const zipReader = new ZipReader(zipFileReader);
const entries = await zipReader.getEntries();

const docEntry = entries.find(
  ({ filename }) => filename === 'word/document.xml'
);

if (!docEntry) {
  throw new Error('Document missing document.xml');
}

const textWriter = new TextWriter();

const content = await docEntry.getData?.(textWriter);

if (!content) {
  throw new Error('Document document.xml empty');
}

const document = new DOMParser().parseFromString(content, 'text/xml');

const root = Array.from(document.childNodes).find(
  ({ nodeName }) => nodeName === 'w:document'
);

if (!root) {
  throw new Error("Document document.xml missing 'm:document' element");
}

const body = Array.from(root.childNodes).find(
  ({ nodeName }) => nodeName === 'w:body'
);

if (!body) {
  throw new Error("Document document.xml missing 'm:body' element");
}

const docxElements = Array.from(body.childNodes).filter(
  (node): node is Element => node instanceof Element
);

const paragraphChildren = docxElements.reduce<Paragraph[]>((acc, element) => {
  switch (element.nodeName) {
    case 'w:p': {
      const paragraph = convertParagraphElement(element);
      return paragraph.children.length > 0 ? [...acc, paragraph] : acc;
    }
    default: {
      return acc;
    }
  }
}, []);

const mdChildren: RootContent[] = [];
let currentList: Paragraph[] = [];
const styles = predictStyles(paragraphChildren);

for (const element of paragraphChildren) {
  if (
    element.type === 'paragraph' &&
    element.data?.paragraphStyle === 'ListParagraph'
  ) {
    currentList.push(element);
  } else {
    if (currentList.length > 0) {
      const list: List = {
        type: 'list',
        children: currentList.map((item) => ({
          type: 'listItem',
          children: [item],
        })),
      };

      currentList = [];

      mdChildren.push(list);
    }

    if (styles.h1Style.matches.includes(element)) {
      mdChildren.push({
        type: 'heading',
        depth: 1,
        children: element.children,
      });
    } else if (styles.h2Style.matches.includes(element)) {
      mdChildren.push({
        type: 'heading',
        depth: 2,
        children: element.children,
      });
    } else {
      mdChildren.push(element);
    }
  }
  // console.log(element.data);
}

const mdTree: Root = {
  type: 'root',
  children: mdChildren,
};

const markdown = toMarkdown(mdTree, { bullet: '-' });

console.log(markdown);

function validateEmail(email: string) {
  const regex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return regex.test(email);
}

function getChildren(node: ChildNode, type?: string) {
  return Array.from(node.childNodes).filter(
    (node): node is Element =>
      node instanceof Element && (type === undefined || node.nodeName === type)
  );
}

function getChild(node: ChildNode, type?: string) {
  return Array.from(node.childNodes).find(
    (node): node is Element =>
      node instanceof Element && (type === undefined || node.nodeName === type)
  );
}

function convertParagraphElement(element: Element) {
  const metadata = getParagraphMetadata(element);
  const childNodes = getChildren(element);

  const children = childNodes.reduce<PhrasingContent[]>((acc, element) => {
    const child = convertParagraphChild(element);

    // console.log(child);

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

function getParagraphMetadata(element: Element) {
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

function convertParagraphChild(element: Element): PhrasingContent | undefined {
  // console.log(element.nodeName);
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

function predictStyles(paragraphChildren: Paragraph[]) {
  type Style = {
    fontSize?: number;
    isBold: boolean;
    isUnderlined: boolean;
    justifyClass?: string;
    matches: Paragraph[];
  };

  const uniqueStyles = paragraphChildren.reduce<Style[]>(
    (styles, paragraph) => {
      // console.log(paragraph.children.length === 0);
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

    const averageWordCount = wordCounts.reduce((sum, count) => sum + count, 0);

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

function shallowCompare<T extends Record<string, any>>(
  a: T,
  b: T,
  keys?: (keyof T)[]
) {
  return Object.entries(a)
    .filter(([key]) => keys === undefined || keys.includes(key))
    .every(([key, value]) => value === b[key]);
}

function extractKeys<T extends Record<string, any>>(
  object: T,
  keys: (keyof T)[]
) {
  return Object.entries(object).reduce<T>((acc, [key, value]) => {
    if (!keys.includes(key)) {
      return acc;
    }

    return {
      ...acc,
      [key]: value,
    };
  }, {} as T);
}
