import { Heading, Paragraph } from 'mdast';
import { MappedElement } from '../mapper';
import { Processor } from '../processor';
import { shallowCompare } from '../util';

export class HeadingProcessor implements Processor<MappedElement> {
  styles: any;

  async start(elements: MappedElement[]) {
    const paragraphElements = elements.filter(
      (element): element is Paragraph => element.type === 'paragraph'
    );

    this.styles = this.predictStyles(paragraphElements);
  }

  async processElement(element: MappedElement) {
    if (element.type !== 'paragraph') {
      return;
    }

    if (this.styles.h1Style.matches.includes(element)) {
      const heading: Heading = {
        type: 'heading',
        depth: 1,
        children: element.children,
      };
      return [heading];
    } else if (this.styles.h2Style.matches.includes(element)) {
      const heading: Heading = {
        type: 'heading',
        depth: 2,
        children: element.children,
      };
      return [heading];
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
