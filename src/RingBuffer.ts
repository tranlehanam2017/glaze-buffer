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
    const space = this.availableWrite;
    const bytesToWrite = Math.min(input.length, space);

    if (bytesToWrite === 0) return 0;

    const firstChunkSize = Math.min(bytesToWrite, this.size - this.writeOffset);
    this.buffer.set(input.subarray(0, firstChunkSize), this.writeOffset);

    if (bytesToWrite > firstChunkSize) {
      const secondChunkSize = bytesToWrite - firstChunkSize;
      this.buffer.set(input.subarray(firstChunkSize, bytesToWrite), 0);
    }

    this.writeOffset = (this.writeOffset + bytesToWrite) % this.size;
    this.count += bytesToWrite;

    return bytesToWrite;
  }

  public read(length: number): Uint8Array {
    const bytesToRead = Math.min(length, this.count);
    if (bytesToRead === 0) return new Uint8Array(0);

    const output = new Uint8Array(bytesToRead);
    const firstChunkSize = Math.min(bytesToRead, this.size - this.readOffset);
    
    output.set(this.buffer.subarray(this.readOffset, this.readOffset + firstChunkSize));

    if (bytesToRead > firstChunkSize) {
      const secondChunkSize = bytesToRead - firstChunkSize;
      output.set(this.buffer.subarray(0, secondChunkSize), firstChunkSize);
    }

    this.readOffset = (this.readOffset + bytesToRead) % this.size;
    this.count -= bytesToRead;

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