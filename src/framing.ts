import { RingBuffer } from './RingBuffer';

/**
 * Returns the number of bytes needed to encode `value` as an unsigned LEB128 varint.
 */
export function varUintSize(value: number): number {
  if (value < 0) throw new Error('value must be non-negative');
  let size = 1;
  let v = value;
  while (v >= 0x80) {
    v = Math.floor(v / 128);
    size++;
  }
  return size;
}

/**
 * Non-destructively reads an unsigned varint at the given readable-byte offset.
 * Returns its value and encoded byte length, or null if the bytes are missing or malformed.
 */
export function peekVarUintAt(
  buffer: RingBuffer,
  byteOffset: number,
): { value: number; size: number } | null {
  let result = 0;
  let size = 0;
  for (let i = 0; i < 5; i++) {
    const b = buffer.peekUint8(byteOffset + i);
    if (b === null) return null;
    result += (b & 0x7f) * (1 << (7 * i));
    size++;
    if ((b & 0x80) === 0) {
      // 5th byte must not overflow 32 bits.
      if (i === 4 && (b & 0xf0) !== 0) return null;
      return { value: result, size };
    }
  }
  // 5 bytes with the continuation bit still set is malformed.
  return null;
}

/**
 * Writes a single length-prefixed frame (varint length followed by payload).
 * Returns true only if the whole frame fit and was written atomically.
 */
export function writeFrame(
  buffer: RingBuffer,
  data: Uint8Array | number[],
): boolean {
  const input = data instanceof Uint8Array ? data : new Uint8Array(data);
  const lenSize = varUintSize(input.length);
  if (!buffer.canWrite(lenSize + input.length)) return false;
  if (!buffer.writeVarUint(input.length)) return false;
  if (input.length > 0) {
    const written = buffer.write(input);
    if (written !== input.length) return false;
  }
  return true;
}

/**
 * Returns true when at least one complete frame is available to read.
 */
export function hasCompleteFrame(buffer: RingBuffer): boolean {
  const info = peekVarUintAt(buffer, 0);
  if (!info) return false;
  return buffer.availableRead >= info.size + info.value;
}

/**
 * Reads and consumes the next complete frame. Returns null if no complete frame is available.
 */
export function readFrame(buffer: RingBuffer): Uint8Array | null {
  const info = peekVarUintAt(buffer, 0);
  if (!info) return null;
  const total = info.size + info.value;
  if (buffer.availableRead < total) return null;
  const all = buffer.read(total);
  if (all.length !== total) return null;
  return all.slice(info.size);
}

/**
 * Non-destructively reads the next complete frame. Returns null if unavailable.
 */
export function peekFrame(buffer: RingBuffer): Uint8Array | null {
  const info = peekVarUintAt(buffer, 0);
  if (!info) return null;
  const total = info.size + info.value;
  if (buffer.availableRead < total) return null;
  const all = buffer.peek(total);
  if (all.length < total) return null;
  const out = new Uint8Array(info.value);
  out.set(all.subarray(info.size, info.size + info.value));
  return out;
}

/**
 * Consumes and discards the next complete frame. Returns false if unavailable.
 */
export function discardFrame(buffer: RingBuffer): boolean {
  const info = peekVarUintAt(buffer, 0);
  if (!info) return false;
  const total = info.size + info.value;
  if (buffer.availableRead < total) return false;
  const discarded = buffer.read(total);
  return discarded.length === total;
}

/**
 * Reads all complete frames, consuming them. Stops at the first incomplete frame.
 */
export function readAllFrames(buffer: RingBuffer): Uint8Array[] {
  const out: Uint8Array[] = [];
  while (buffer.hasData()) {
    const frame = readFrame(buffer);
    if (frame === null) break;
    out.push(frame);
  }
  return out;
}

/**
 * Ergonomic wrapper around a RingBuffer exposing framed message operations.
 */
export class FramedRingBuffer {
  constructor(public readonly buffer: RingBuffer) {}

  public writeFrame(data: Uint8Array | number[]): boolean {
    return writeFrame(this.buffer, data);
  }

  public readFrame(): Uint8Array | null {
    return readFrame(this.buffer);
  }

  public peekFrame(): Uint8Array | null {
    return peekFrame(this.buffer);
  }

  public hasCompleteFrame(): boolean {
    return hasCompleteFrame(this.buffer);
  }

  public discardFrame(): boolean {
    return discardFrame(this.buffer);
  }

  public readAllFrames(): Uint8Array[] {
    return readAllFrames(this.buffer);
  }
}
