import { MappedElement } from '../mapper';
import { Processor } from '../processor';

export class PassthroughProcessor implements Processor {
  async processElement(element: MappedElement) {
    console.log('passthrough', element);
    return element;
  }
}
