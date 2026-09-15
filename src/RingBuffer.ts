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

  public writeUint8(value: number): boolean {
    if (this.availableWrite < 1) return false;
    this.write([value & 0xFF]);
    return true;
  }

  public writeInt8(value: number): boolean {
    return this.writeUint8(value);
  }

  public writeBoolean(value: boolean): boolean {
    return this.writeUint8(value ? 1 : 0);
  }

  public writeUint16(value: number): boolean {
    if (this.availableWrite < 2) return false;
    this.write([
      (value >>> 8) & 0xFF,
      value & 0xFF
    ]);
    return true;
  }

  public writeInt16(value: number): boolean {
    return this.writeUint16(value);
  }

  public writeUint32(value: number): boolean {
    if (this.availableWrite < 4) return false;
    this.write([
      (value >>> 24) & 0xFF,
      (value >>> 16) & 0xFF,
      (value >>> 8) & 0xFF,
      value & 0xFF
    ]);
    return true;
  }

  public writeInt32(value: number): boolean {
    return this.writeUint32(value);
  }

  public writeUint64(value: bigint): boolean {
    if (this.availableWrite < 8) return false;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, value, false);
    this.write(new Uint8Array(buf));
    return true;
  }

  public writeInt64(value: bigint): boolean {
    if (this.availableWrite < 8) return false;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigInt64(0, value, false);
    this.write(new Uint8Array(buf));
    return true;
  }

  public writeFloat32(value: number): boolean {
    if (this.availableWrite < 4) return false;
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, false);
    this.write(new Uint8Array(buf));
    return true;
  }

  public writeFloat64(value: number): boolean {
    if (this.availableWrite < 8) return false;
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, false);
    this.write(new Uint8Array(buf));
    return true;
  }

  public writeString(value: string): boolean {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(value);
    if (this.availableWrite < encoded.length) return false;
    this.write(encoded);
    return true;
  }

  public writePrefixedString(value: string): boolean {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(value);
    if (this.availableWrite < 4 + encoded.length) return false;
    
    this.writeUint32(encoded.length);
    this.write(encoded);
    return true;
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

  public readByte(): number | null {
    if (this.count === 0) return null;
    
    const byte = this.buffer[this.readOffset];
    this.readOffset = (this.readOffset + 1) % this.size;
    this.count--;
    
    return byte;
  }

  public readUint8(): number | null {
    return this.readByte();
  }

  public readInt8(): number | null {
    const byte = this.readUint8();
    if (byte === null) return null;
    return byte < 128 ? byte : byte - 256;
  }

  public readBoolean(): boolean | null {
    const byte = this.readUint8();
    if (byte === null) return null;
    return byte !== 0;
  }

  public readUint16(): number | null {
    if (this.count < 2) return null;
    const bytes = this.read(2);
    // Big-endian read
    return (bytes[0] << 8) | bytes[1];
  }

  public readInt16(): number | null {
    const val = this.readUint16();
    if (val === null) return null;
    return val < 32768 ? val : val - 65536;
  }

  public readUint32(): number | null {
    if (this.count < 4) return null;
    const bytes = this.read(4);
    // Big-endian read
    return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  }

  public readInt32(): number | null {
    const val = this.readUint32();
    if (val === null) return null;
    return val < 2147483648 ? val : val - 4294967296;
  }

  public readUint64(): bigint | null {
    if (this.count < 8) return null;
    const bytes = this.read(8);
    return new DataView(bytes.buffer).getBigUint64(0, false);
  }

  public readInt64(): bigint | null {
    if (this.count < 8) return null;
    const bytes = this.read(8);
    return new DataView(bytes.buffer).getBigInt64(0, false);
  }

  public readFloat32(): number | null {
    if (this.count < 4) return null;
    const bytes = this.read(4);
    return new DataView(bytes.buffer).getFloat32(0, false);
  }

  public readFloat64(): number | null {
    if (this.count < 8) return null;
    const bytes = this.read(8);
    return new DataView(bytes.buffer).getFloat64(0, false);
  }

  public readString(length: number): string | null {
    if (this.count < length) return null;
    const bytes = this.read(length);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  public readPrefixedString(): string | null {
    const length = this.readUint32();
    if (length === null) return null;
    return this.readString(length);
  }

  public readExactly(length: number): Uint8Array | null {
    if (this.count < length) return null;
    return this.read(length);
  }

  public drain(): Uint8Array {
    return this.read(this.count);
  }

  public readAvailable(): Uint8Array {
    return this.read(this.count);
  }

  public peek(length: number): Uint8Array {
    return this.slice(0, length);
  }

  public peekAll(): Uint8Array {
    return this.slice(0, this.count);
  }

  /**
   * Returns a copy of a portion of the available data without consuming it.
   * @param start The start offset relative to the current read position.
   * @param end The end offset relative to the current read position (exclusive).
   * @returns A Uint8Array containing the requested slice.
   */
  public slice(start: number, end: number): Uint8Array {
    if (start < 0) return new Uint8Array(0);
    if (start >= this.count) return new Uint8Array(0);

    const actualEnd = Math.min(end, this.count);
    const length = Math.max(0, actualEnd - start);
    if (length === 0) return new Uint8Array(0);

    const output = new Uint8Array(length);
    const internalStart = (this.readOffset + start) % this.size;
    const firstChunkSize = Math.min(length, this.size - internalStart);
    
    output.set(this.buffer.subarray(internalStart, internalStart + firstChunkSize));

    if (length > firstChunkSize) {
      const secondChunkSize = length - firstChunkSize;
      output.set(this.buffer.subarray(0, secondChunkSize), firstChunkSize);
    }

    return output;
  }

  public resize(newCapacity: number): void {
    if (newCapacity === this.size) return;

    const newBuffer = new Uint8Array(newCapacity);
    const data = this.peekAll();
    
    // Clear and reset offsets to normalize the buffer in the new array
    this.buffer = newBuffer;
    this.size = newCapacity;
    this.readOffset = 0;
    this.writeOffset = 0;
    this.count = 0;

    // Write back the existing data
    this.write(data);
  }

  /**
   * Moves the read pointer relative to the current position.
   * @param offset The number of bytes to move. Positive for forward, negative for backward.
   * @returns True if the seek was successful, false if it would move outside the available data window.
   */
  public seek(offset: number): boolean {
    if (offset === 0) return true;

    if (offset < 0) return false; // Backward seek not supported to prevent reading overwritten data
    if (offset > this.count) return false;

    this.readOffset = (this.readOffset + offset) % this.size;
    this.count -= offset;
    return true;
  }

  public get availableRead(): number {
    return this.count;
  }

  public get availableWrite(): number {
    return this.size - this.count;
  }

  public isEmpty(): boolean {
    return this.count === 0;
  }

  public isFull(): boolean {
    return this.count === this.size;
  }

  public clear(): void {
    this.readOffset = 0;
    this.writeOffset = 0;
    this.count = 0;
  }

  /**
   * Copies data from another RingBuffer into this one.
   * @param other The source RingBuffer
   * @param length The maximum number of bytes to copy. If -1, copies all available data.
   * @returns The number of bytes actually copied.
   */
  public copyFrom(other: RingBuffer, length: number = -1): number {
    const bytesToCopy = length === -1 ? other.availableRead : Math.min(length, other.availableRead);
    if (bytesToCopy === 0) return 0;

    const data = other.read(bytesToCopy);
    return this.write(data);
  }

  *[Symbol.iterator](): Iterator<number> {
    let current = 0;
    while (current < this.count) {
      yield this.buffer[(this.readOffset + current) % this.size];
      current++;
    }
  }
}
