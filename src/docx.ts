import { DOMParser } from '@xmldom/xmldom';
import { Element } from '@xmldom/xmldom/lib/dom';
import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';

export async function getDocxElements(blob: Blob) {
  const zipFileReader = new BlobReader(blob);

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

  return docxElements;
}

export function getChildren(node: ChildNode, type?: string) {
  return Array.from(node.childNodes).filter(
    (node): node is Element =>
      node instanceof Element && (type === undefined || node.nodeName === type)
  );
}

export function getChild(node: ChildNode, type?: string) {
  return Array.from(node.childNodes).find(
    (node): node is Element =>
      node instanceof Element && (type === undefined || node.nodeName === type)
  );
}
