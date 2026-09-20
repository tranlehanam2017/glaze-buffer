export class RingBuffer {
  private buffer: Uint8Array;
  private readOffset: number = 0;
  private writeOffset: number = 0;
  private size: number;
  private count: number = 0;
  private scratch = new Uint8Array(8); // Reusable buffer for primitives
  private scratchView = new DataView(this.scratch.buffer);
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

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

  /**
   * Writes the entire input buffer. Returns true if successful, 
   * or false if there is insufficient space to write the whole buffer.
   * @param data The data to write.
   * @returns True if all data was written, false otherwise.
   */
  public writeAll(data: Uint8Array | number[]): boolean {
    const input = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (this.availableWrite < input.length) return false;
    this.write(input);
    return true;
  }

  /**
   * Writes exactly the specified number of bytes from the source buffer.
   * @param source The source Uint8Array.
   * @param length The number of bytes to write.
   * @returns True if the write was successful, false if insufficient space exists.
   */
  public writeExactly(source: Uint8Array, length: number): boolean {
    if (this.availableWrite < length) return false;
    this.write(source.subarray(0, length));
    return true;
  }

  /**
   * Writes data from a source buffer starting at a specific offset.
   * @param source The source Uint8Array.
   * @param offset The offset in the source buffer to start reading from.
   * @param length The maximum number of bytes to write.
   * @returns The number of bytes actually written.
   */
  public writeInto(source: Uint8Array, offset: number, length: number): number {
    if (offset < 0 || offset >= source.length) return 0;
    const availableInSource = source.length - offset;
    const bytesToWrite = Math.min(length, availableInSource, this.availableWrite);
    if (bytesToWrite === 0) return 0;

    return this.write(source.subarray(offset, offset + bytesToWrite));
  }

  public writeUint8(value: number): boolean {
    if (this.availableWrite < 1) return false;
    this.buffer[this.writeOffset] = value & 0xFF;
    this.writeOffset = (this.writeOffset + 1) % this.size;
    this.count++;
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
    
    const high = (value >>> 8) & 0xFF;
    const low = value & 0xFF;
    
    this.buffer[this.writeOffset] = high;
    this.buffer[(this.writeOffset + 1) % this.size] = low;
    
    this.writeOffset = (this.writeOffset + 2) % this.size;
    this.count += 2;
    return true;
  }

  public writeInt16(value: number): boolean {
    return this.writeUint16(value);
  }

  private writePrimitives(bytes: number): boolean {
    const space = this.availableWrite;
    if (space < bytes) return false;

    const firstChunkSize = Math.min(bytes, this.size - this.writeOffset);
    this.buffer.set(this.scratch.subarray(0, firstChunkSize), this.writeOffset);

    if (bytes > firstChunkSize) {
      const secondChunkSize = bytes - firstChunkSize;
      this.buffer.set(this.scratch.subarray(firstChunkSize, bytes), 0);
    }

    this.writeOffset = (this.writeOffset + bytes) % this.size;
    this.count += bytes;
    return true;
  }

  public writeUint32(value: number): boolean {
    this.scratchView.setUint32(0, value, false);
    return this.writePrimitives(4);
  }

  public writeInt32(value: number): boolean {
    this.scratchView.setInt32(0, value, false);
    return this.writePrimitives(4);
  }

  public writeUint64(value: bigint): boolean {
    this.scratchView.setBigUint64(0, value, false);
    return this.writePrimitives(8);
  }

  public writeInt64(value: bigint): boolean {
    this.scratchView.setBigInt64(0, value, false);
    return this.writePrimitives(8);
  }

  public writeFloat32(value: number): boolean {
    this.scratchView.setFloat32(0, value, false);
    return this.writePrimitives(4);
  }

  public writeFloat64(value: number): boolean {
    this.scratchView.setFloat64(0, value, false);
    return this.writePrimitives(8);
  }

  public writeString(value: string): boolean {
    const encoded = this.encoder.encode(value);
    if (this.availableWrite < encoded.length) return false;
    this.write(encoded);
    return true;
  }

  public writePrefixedString(value: string): boolean {
    const encoded = this.encoder.encode(value);
    if (this.availableWrite < 4 + encoded.length) return false;
    
    this.writeUint32(encoded.length);
    this.write(encoded);
    return true;
  }

  /**
   * Writes an unsigned integer using LEB128 variable-length encoding.
   * @param value The value to write.
   * @returns True if successfully written, false if buffer space is insufficient.
   */
  public writeVarUint(value: number): boolean {
    if (value < 0) return false;
    // Max 5 bytes for 32-bit unsigned int in LEB128
    if (this.availableWrite < 5) return false; 

    let v = value;
    let written = 0;
    while (v >= 0x80) {
      this.writeUint8((v & 0x7f) | 0x80);
      v >>>= 7;
      written++;
    }
    this.writeUint8(v & 0x7f);
    written++;
    return true;
  }

  public read(length: number): Uint8Array {
    const bytesToRead = Math.min(length, this.count);
    if (bytesToRead === 0) return new Uint8Array(0);

    const output = new Uint8Array(bytesToRead);
    this.readInto(output, bytesToRead);

    return output;
  }

  /**
   * Reads up to 'length' bytes into the provided target buffer.
   * @param target The destination Uint8Array.
   * @param length The maximum number of bytes to read.
   * @returns The number of bytes actually read into the target.
   */
  public readInto(target: Uint8Array, length: number): number {
    return this.readIntoAt(target, 0, length);
  }

  /**
   * Reads up to 'length' bytes into the provided target buffer starting at the specified offset.
   * @param target The destination Uint8Array.
   * @param offset The offset in the target buffer to start writing data.
   * @param length The maximum number of bytes to read.
   * @returns The number of bytes actually read into the target.
   */
  public readIntoAt(target: Uint8Array, offset: number, length: number): number {
    if (offset < 0 || offset >= target.length) return 0;
    
    const availableInTarget = target.length - offset;
    const bytesToRead = Math.min(length, this.count, availableInTarget);
    if (bytesToRead === 0) return 0;

    const firstChunkSize = Math.min(bytesToRead, this.size - this.readOffset);
    target.set(this.buffer.subarray(this.readOffset, this.readOffset + firstChunkSize), offset);

    if (bytesToRead > firstChunkSize) {
      const secondChunkSize = bytesToRead - firstChunkSize;
      target.set(this.buffer.subarray(0, secondChunkSize), offset + firstChunkSize);
    }

    this.readOffset = (this.readOffset + bytesToRead) % this.size;
    this.count -= bytesToRead;

    return bytesToRead;
  }

  /**
   * Reads up to 'length' bytes into the buffer associated with the provided DataView.
   * @param view The destination DataView.
   * @param offset The offset in the DataView's buffer to start writing data.
   * @param length The maximum number of bytes to read.
   * @returns The number of bytes actually read into the view.
   */
  public readIntoView(view: DataView, offset: number, length: number): number {
    const target = new Uint8Array(view.buffer, view.byteOffset + offset, view.byteLength - offset);
    return this.readIntoAt(target, 0, length);
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
    return (byte << 24) >> 24; // Efficient sign extension for 8-bit
  }

  public readBoolean(): boolean | null {
    const byte = this.readUint8();
    if (byte === null) return null;
    return byte !== 0;
  }

  public readUint16(): number | null {
    if (this.count < 2) return null;
    
    const high = this.buffer[this.readOffset];
    const low = this.buffer[(this.readOffset + 1) % this.size];
    
    this.readOffset = (this.readOffset + 2) % this.size;
    this.count -= 2;
    
    return (high << 8) | low;
  }

  public readInt16(): number | null {
    const val = this.readUint16();
    if (val === null) return null;
    return (val << 16) >> 16; // Efficient sign extension for 16-bit
  }

  public readUint32(): number | null {
    if (this.count < 4) return null;
    this.readInto(this.scratch, 4);
    return this.scratchView.getUint32(0, false);
  }

  public readInt32(): number | null {
    if (this.count < 4) return null;
    this.readInto(this.scratch, 4);
    return this.scratchView.getInt32(0, false);
  }

  public readUint64(): bigint | null {
    if (this.count < 8) return null;
    this.readInto(this.scratch, 8);
    return this.scratchView.getBigUint64(0, false);
  }

  public readInt64(): bigint | null {
    if (this.count < 8) return null;
    this.readInto(this.scratch, 8);
    return this.scratchView.getBigInt64(0, false);
  }

  public readFloat32(): number | null {
    if (this.count < 4) return null;
    this.readInto(this.scratch, 4);
    return this.scratchView.getFloat32(0, false);
  }

  public readFloat64(): number | null {
    if (this.count < 8) return null;
    this.readInto(this.scratch, 8);
    return this.scratchView.getFloat64(0, false);
  }

  public readString(length: number): string | null {
    if (this.count < length) return null;
    const bytes = this.read(length);
    return this.decoder.decode(bytes);
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

  /**
   * Reads an unsigned integer using LEB128 variable-length encoding.
   * @returns The decoded value, or null if the buffer is empty or the varint is malformed (exceeds 5 bytes).
   */
  public readVarUint(): number | null {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;

    while (true) {
      const byte = this.readUint8();
      if (byte === null) return null;

      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;

      shift += 7;
      bytesRead++;
      if (bytesRead >= 5) return null; // Prevent overflow/malformed data
    }

    return result;
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

  public peekByte(): number | null {
    if (this.count === 0) return null;
    return this.buffer[this.readOffset];
  }

  /**
   * Returns a DataView of the available data starting from the current read position.
   * If the data wraps around the internal buffer, it returns a view of the contiguous
   * part starting from the read offset. Use peek() or slice() for wrapped data.
   * @returns A DataView if data is available, otherwise null.
   */
  public peekView(): DataView | null {
    if (this.count === 0) return null;
    const contiguousLength = Math.min(this.count, this.size - this.readOffset);
    return new DataView(this.buffer.buffer, this.buffer.byteOffset + this.readOffset, contiguousLength);
  }

  /**
   * Peeks up to 'length' bytes into the provided target buffer without consuming data.
   * @param target The destination Uint8Array.
   * @param length The maximum number of bytes to peek.
   * @returns The number of bytes actually peeked into the target.
   */
  public peekInto(target: Uint8Array, length: number): number {
    return this.peekIntoAt(target, 0, length);
  }

  /**
   * Peeks up to 'length' bytes into the provided target buffer starting at the specified offset
   * without consuming data.
   * @param target The destination Uint8Array.
   * @param offset The offset in the target buffer to start writing data.
   * @param length The maximum number of bytes to peek.
   * @returns The number of bytes actually peeked into the target.
   */
  public peekIntoAt(target: Uint8Array, offset: number, length: number): number {
    if (offset < 0 || offset >= target.length) return 0;

    const availableInTarget = target.length - offset;
    const bytesToPeek = Math.min(length, this.count, availableInTarget);
    if (bytesToPeek === 0) return 0;

    const firstChunkSize = Math.min(bytesToPeek, this.size - this.readOffset);
    target.set(this.buffer.subarray(this.readOffset, this.readOffset + firstChunkSize), offset);

    if (bytesToPeek > firstChunkSize) {
      const secondChunkSize = bytesToPeek - firstChunkSize;
      target.set(this.buffer.subarray(0, secondChunkSize), offset + firstChunkSize);
    }

    return bytesToPeek;
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

  /**
   * Peeks at exactly the specified number of bytes without consuming them.
   * @param length The number of bytes to peek.
   * @returns A Uint8Array if enough data is available, otherwise null.
   */
  public peekExactly(length: number): Uint8Array | null {
    if (this.count < length) return null;
    return this.peek(length);
  }

  /**
   * Peeks at an unsigned 8-bit integer at the specified offset without consuming data.
   * @param offset Offset relative to the current read head.
   * @returns The value, or null if offset is out of bounds.
   */
  public peekUint8(offset: number = 0): number | null {
    if (offset < 0 || offset >= this.count) return null;
    return this.buffer[(this.readOffset + offset) % this.size];
  }

  /**
   * Peeks at a signed 8-bit integer at the specified offset without consuming data.
   * @param offset Offset relative to the current read head.
   * @returns The value, or null if offset is out of bounds.
   */
  public peekInt8(offset: number = 0): number | null {
    const val = this.peekUint8(offset);
    if (val === null) return null;
    return (val << 24) >> 24;
  }

  /**
   * Peeks at an unsigned 16-bit integer at the specified offset without consuming data.
   * @param offset Offset relative to the current read head.
   * @returns The value, or null if insufficient data is available at the offset.
   */
  public peekUint16(offset: number = 0): number | null {
    if (offset < 0 || offset + 2 > this.count) return null;
    const internalOffset = (this.readOffset + offset) % this.size;
    const high = this.buffer[internalOffset];
    const low = this.buffer[(internalOffset + 1) % this.size];
    return (high << 8) | low;
  }

  /**
   * Peeks at a signed 16-bit integer at the specified offset without consuming data.
   * @param offset Offset relative to the current read head.
   * @returns The value, or null if insufficient data is available at the offset.
   */
  public peekInt16(offset: number = 0): number | null {
    const val = this.peekUint16(offset);
    if (val === null) return null;
    return (val << 16) >> 16;
  }

  /**
   * Peeks at an unsigned 32-bit integer at the specified offset without consuming data.
   * @param offset Offset relative to the current read head.
   * @returns The value, or null if insufficient data is available at the offset.
   */
  public peekUint32(offset: number = 0): number | null {
    if (offset < 0 || offset + 4 > this.count) return null;
    
    const temp = new Uint8Array(4);
    const internalReadOffset = this.readOffset;
    
    this.readOffset = (this.readOffset + offset) % this.size;
    this.peekInto(temp, 4);
    this.readOffset = internalReadOffset;

    return new DataView(temp.buffer).getUint32(0, false);
  }

  /**
   * Peeks at a signed 32-bit integer at the specified offset without consuming data.
   * @param offset Offset relative to the current read head.
   * @returns The value, or null if insufficient data is available at the offset.
   */
  public peekInt32(offset: number = 0): number | null {
    if (offset < 0 || offset + 4 > this.count) return null;
    
    const temp = new Uint8Array(4);
    const internalReadOffset = this.readOffset;
    
    this.readOffset = (this.readOffset + offset) % this.size;
    this.peekInto(temp, 4);
    this.readOffset = internalReadOffset;

    return new DataView(temp.buffer).getInt32(0, false);
  }

  /**
   * Peeks at a 32-bit float at the specified offset without consuming data.
   * @param offset Offset relative to the current read head.
   * @returns The value, or null if insufficient data is available at the offset.
   */
  public peekFloat32(offset: number = 0): number | null {
    if (offset < 0 || offset + 4 > this.count) return null;
    
    const temp = new Uint8Array(4);
    const internalReadOffset = this.readOffset;
    
    this.readOffset = (this.readOffset + offset) % this.size;
    this.peekInto(temp, 4);
    this.readOffset = internalReadOffset;

    return new DataView(temp.buffer).getFloat32(0, false);
  }

  /**
   * Peeks at a 64-bit float at the specified offset without consuming data.
   * @param offset Offset relative to the current read head.
   * @returns The value, or null if insufficient data is available at the offset.
   */
  public peekFloat64(offset: number = 0): number | null {
    if (offset < 0 || offset + 8 > this.count) return null;
    
    const temp = new Uint8Array(8);
    const internalReadOffset = this.readOffset;
    
    this.readOffset = (this.readOffset + offset) % this.size;
    this.peekInto(temp, 8);
    this.readOffset = internalReadOffset;

    return new DataView(temp.buffer).getFloat64(0, false);
  }

  public resize(newCapacity: number): void {
    if (newCapacity === this.size) return;

    const newBuffer = new Uint8Array(newCapacity);
    const data = this.peekAll();
    
    this.buffer = newBuffer;
    this.size = newCapacity;
    this.readOffset = 0;
    this.writeOffset = 0;
    this.count = 0;

    this.write(data);
  }

  public seek(offset: number): boolean {
    if (offset === 0) return true;

    if (offset < 0) return false;
    if (offset > this.count) return false;

    this.readOffset = (this.readOffset + offset) % this.size;
    this.count -= offset;
    return true;
  }

  public seekTo(position: number): boolean {
    if (position < 0 || position > this.count) return false;

    const currentHead = this.readOffset;
    this.readOffset = (currentHead + position) % this.size;
    this.count -= position;
    return true;
  }

  public get availableRead(): number {
    return this.count;
  }

  public get availableWrite(): number {
    return this.size - this.count;
  }

  public get capacity(): number {
    return this.size;
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

  public compact(): void {
    if (this.count === 0) {
      this.readOffset = 0;
      this.writeOffset = 0;
      return;
    }

    if (this.readOffset === 0) {
      return;
    }

    const data = this.peekAll();
    this.buffer.set(data, 0);
    this.readOffset = 0;
    this.writeOffset = this.count;
  }

  public copyFrom(other: RingBuffer, length: number = -1): number {
    const bytesToCopy = length === -1 ? other.availableRead : Math.min(length, other.availableRead);
    if (bytesToCopy === 0) return 0;

    const data = other.read(bytesToCopy);
    return this.write(data);
  }

  public canRead(length: number): boolean {
    return this.count >= length;
  }

  *[Symbol.iterator](): Iterator<number> {
    let current = 0;
    while (current < this.count) {
      yield this.buffer[(this.readOffset + current) % this.size];
      current++;
    }
  }
}
