# glaze-buffer

A high-performance ring buffer implementation in TypeScript for efficient streaming of binary data.

## Features

- Fixed-capacity circular buffer with wrap-around reads/writes
- Primitive, varint, string, float, and 64-bit integer helpers
- Non-destructive peeks and slices
- Resize, compact, copy, and iterator support
- Length-prefixed frame codec for streaming framed messages

## Setup

```bash
npm install
npm run build
```

## Test

```bash
npm test
```

## Usage

```ts
import { RingBuffer } from './src/RingBuffer';

const rb = new RingBuffer(1024);

rb.write([1, 2, 3, 4]);
const data = rb.read(2);
console.log(data); // Uint8Array [1, 2]

const peeked = rb.peek(2);
console.log(peeked); // Uint8Array [3, 4]

rb.writeUint32(0xdecafbad);
console.log(rb.readUint32()); // 3737844653

const all = rb.drain();
console.log(all);
```

## Framing

```ts
import { RingBuffer, writeFrame, readFrame } from './src/index';

const rb = new RingBuffer(1024);
writeFrame(rb, [1, 2, 3]);
console.log(readFrame(rb)); // Uint8Array [1, 2, 3]
```

## License

MIT
