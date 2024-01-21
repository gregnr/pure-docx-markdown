import { readFile } from 'fs/promises';
import { Root } from 'mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { getDocxElements } from './docx';
import { mapElements } from './mapper';
import { ParagraphMapper } from './mappers/paragraph-mapper';
import { processElements } from './processor';
import { HeadingProcessor } from './processors/heading-processor';
import { ListProcessor } from './processors/list-processor';
import { PassthroughProcessor } from './processors/passthrough-processor';
import { PhrasingProcessor } from './processors/phrasing-processor';
import { BoldProcessor } from './processors/phrasing/bold-processor';

const docxSample = await readFile('my-doc.docx');

const docxBlob = new Blob([docxSample], {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

const docxElements = await getDocxElements(docxBlob);

const intermediateElements = await mapElements(docxElements, [
  new ParagraphMapper(),
]);

const markdownElements = await processElements(intermediateElements, [
  new PhrasingProcessor([new BoldProcessor(), new PassthroughProcessor()]),
  new ListProcessor(),
  new HeadingProcessor(),
  new PassthroughProcessor(),
]);

const markdownTree: Root = {
  type: 'root',
  children: markdownElements,
};

const markdown = toMarkdown(markdownTree, { bullet: '-' });

console.log(markdown);
