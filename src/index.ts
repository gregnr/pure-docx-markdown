import { readFile } from 'fs/promises';
import { Root } from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import {
  HeadingProcessor,
  ListItemProcessor,
  PassthroughProcessor,
  mapElements,
  processElements,
} from './convert';
import { getDocxElements } from './docx';

const docxSample = await readFile('my-doc.docx');

const docxBlob = new Blob([docxSample], {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

const docxElements = await getDocxElements(docxBlob);
const intermediateElements = mapElements(docxElements);
const markdownElements = await processElements(intermediateElements, [
  new ListItemProcessor(),
  new HeadingProcessor(),
  new PassthroughProcessor(),
]);

const markdownTree: Root = {
  type: 'root',
  children: markdownElements,
};

const markdown = toMarkdown(markdownTree, { bullet: '-' });

console.log(markdown);
