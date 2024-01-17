import 'mdast';

declare module 'mdast' {
  interface ParagraphData {
    fontSize?: number;
    isBold: boolean;
    isUnderlined: boolean;
    justifyClass?: string;
    paragraphStyle?: string;
  }
}
