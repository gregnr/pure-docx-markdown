import 'mdast';

declare module 'mdast' {
  interface ParagraphData {
    fontSize?: number;
    isBold?: boolean;
    isUnderlined?: boolean;
    justifyClass?: string;
    paragraphStyle?: string;
  }

  interface TextData {
    fontSize?: number;
    isBold: boolean;
    isUnderlined: boolean;
  }

  interface LinkData {
    fontSize?: number;
    isBold: boolean;
    isUnderlined: boolean;
  }
}
