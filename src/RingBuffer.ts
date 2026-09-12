export class RingBuffer {
  private buffer: Uint8Array;
  private readOffset: number = 0;
  private writeOffset: number = 0;
  private size: number;
  private count: number = 0;

  constructor(capacity: number) {
    this.size = capacity;
    this.buffer = new Uint8Array(capacity);
  }

  public write(data: Uint8Array | number[]): number {
    const input = data instanceof Uint8Array ? data : new Uint8Array(data);
    let bytesWritten = 0;

    for (let i = 0; i < input.length; i++) {
      if (this.count === this.size) break;
      
      this.buffer[this.writeOffset] = input[i];
      this.writeOffset = (this.writeOffset + 1) % this.size;
      this.count++;
      bytesWritten++;
    }

    return bytesWritten;
  }

  public read(length: number): Uint8Array {
    const output = new Uint8Array(Math.min(length, this.count));
    for (let i = 0; i < output.length; i++) {
      output[i] = this.buffer[this.readOffset];
      this.readOffset = (this.readOffset + 1) % this.size;
      this.count--;
    }
    return output;
  }

  public get availableRead(): number {
    return this.count;
  }

  public get availableWrite(): number {
    return this.size - this.count;
  }

  public clear(): void {
    this.readOffset = 0;
    this.writeOffset = 0;
    this.count = 0;
  }
}