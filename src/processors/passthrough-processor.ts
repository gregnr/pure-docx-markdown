import { Processor } from '../processor';

export class PassthroughProcessor<T> implements Processor<T> {
  async processElement(element: T) {
    return [element];
  }
}
