import { Heading, RootContent } from 'mdast';
import { Processor } from '../processor';

export class HeadingProcessor implements Processor<RootContent> {
  async processNode(node: RootContent) {
    if (node.type !== 'paragraph') {
      return;
    }

    switch (node.data?.paragraphStyle) {
      case 'Title': {
        const heading: Heading = {
          type: 'heading',
          depth: 1,
          children: node.children,
        };
        return { nodes: [heading], continueProcessing: false };
      }
      case 'Heading1': {
        const heading: Heading = {
          type: 'heading',
          depth: 1,
          children: node.children,
        };
        return { nodes: [heading], continueProcessing: false };
      }
      case 'Heading2': {
        const heading: Heading = {
          type: 'heading',
          depth: 2,
          children: node.children,
        };
        return { nodes: [heading], continueProcessing: false };
      }
      case 'Heading3': {
        const heading: Heading = {
          type: 'heading',
          depth: 3,
          children: node.children,
        };
        return { nodes: [heading], continueProcessing: false };
      }
      case 'Heading4': {
        const heading: Heading = {
          type: 'heading',
          depth: 4,
          children: node.children,
        };
        return { nodes: [heading], continueProcessing: false };
      }
    }
  }
}
