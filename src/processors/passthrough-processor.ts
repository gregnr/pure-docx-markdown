import { Processor } from '../processor';

export class PassthroughProcessor<T> implements Processor<T> {
  async processNode(node: T) {
    return [node];
  }
}
