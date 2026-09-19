import { RingBuffer } from '../src/RingBuffer';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testRingBuffer() {
  console.log("Running RingBuffer tests...");

  const rb = new RingBuffer(5);
  
  // Test basic write/read
  rb.write([1, 2, 3]);
  assert(rb.availableRead === 3, "Available read should be 3");
  
  const data = rb.read(2);
  assert(data.length === 2 && data[0] === 1 && data[1] === 2, "Read data mismatch");
  assert(rb.availableRead === 1, "Available read should be 1");

  // Test wrap around
  rb.write([4, 5, 6]);
  const remaining = rb.read(4);
  assert(remaining[0] === 3 && remaining[1] === 4 && remaining[2] === 5 && remaining[3] === 6, "Wrap around read failed");
  
  // Test peek
  rb.write([10, 20]);
  const peeked = rb.peek(2);
  assert(peeked.length === 2 && peeked[0] === 10 && peeked[1] === 20, "Peek data mismatch");
  assert(rb.availableRead === 2, "Peek should not consume data");

  // Test peekAll
  const peekedAll = rb.peekAll();
  assert(peekedAll.length === 2 && peekedAll[0] === 10 && peekedAll[1] === 20, "peekAll data mismatch");
  assert(rb.availableRead === 2, "peekAll should not consume data");

  // Test peekByte
  rb.clear();
  assert(rb.peekByte() === null, "peekByte should return null when empty");
  rb.write([42]);
  assert(rb.peekByte() === 42, "peekByte mismatch");
  assert(rb.availableRead === 1, "peekByte should not consume data");
  rb.readByte();
  assert(rb.peekByte() === null, "peekByte should return null after reading all data");

  // Test isEmpty/isFull
  assert(rb.isEmpty() === false, "Should not be empty");
  rb.read(2);
  assert(rb.isEmpty() === true, "Should be empty after reading all");
  
  rb.write([1, 2, 3, 4, 5]);
  assert(rb.isFull() === true, "Should be full");
  assert(rb.availableWrite === 0, "Available write should be 0 when full");
  
  // Test drain
  rb.clear();
  rb.write([100, 200, 300]);
  const drained = rb.drain();
  assert(drained.length === 3 && drained[0] === 100 && drained[2] === 300, "Drain failed");
  assert(rb.isEmpty(), "Buffer should be empty after drain");

  // Test writing more than capacity
  rb.write([1, 2, 3, 4, 5, 6, 7]);
  assert(rb.availableRead === 5, "Should only have written up to capacity");

  // Test readExactly
  rb.clear();
  rb.write([10, 20, 30]);
  const exact1 = rb.readExactly(5);
  assert(exact1 === null, "readExactly should return null if insufficient data");
  const exact2 = rb.readExactly(2);
  assert(exact2 !== null && exact2.length === 2 && exact2[0] === 10 && exact2[1] === 20, "readExactly read failed");
  assert(rb.availableRead === 1, "Available read should be 1 after readExactly");

  // Test readByte
  rb.clear();
  rb.write([1, 2]);
  assert(rb.readByte() === 1, "readByte should return 1");
  assert(rb.readByte() === 2, "readByte should return 2");
  assert(rb.readByte() === null, "readByte should return null when empty");

  // Test primitive read helpers
  rb.clear();
  rb.write([0, 1, 0, 255, 0, 0, 0, 10]);
  assert(rb.readUint8() === 0, "readUint8 failed");
  assert(rb.readUint16() === 256, "readUint16 failed (0x0100)");
  assert(rb.readUint8() === 0, "readUint8 failed");
  assert(rb.readUint8() === 255, "readUint8 failed");
  assert(rb.readUint32() === 10, "readUint32 failed");
  assert(rb.isEmpty(), "Buffer should be empty after reading primitives");

  // Test signed primitive read helpers
  rb.clear();
  rb.write([255, 255, 255, 255, 0, 1, 255, 255, 255, 255, 255, 255]);
  assert(rb.readInt8() === -1, "readInt8 failed");
  assert(rb.readInt16() === -1, "readInt16 failed");
  assert(rb.readInt32() === -1, "readInt32 failed");
  assert(rb.isEmpty(), "Buffer should be empty after reading signed primitives");

  // Test resize
  rb.clear();
  rb.write([1, 2, 3]);
  rb.resize(10);
  assert(rb.availableRead === 3, "Data should be preserved after resize");
  assert(rb.availableWrite === 7, "New capacity should be reflected in availableWrite");
  rb.write([4, 5, 6, 7, 8, 9, 10]);
  assert(rb.availableRead === 10, "Should be able to write more data after resizing");
  const resizedData = rb.drain();
  assert(resizedData.length === 10 && resizedData[0] === 1 && resizedData[9] === 10, "Resized data integrity check failed");

  // Test seek
  rb.clear();
  rb.write([1, 2, 3, 4, 5]);
  assert(rb.seek(2) === true, "Seek forward should succeed");
  assert(rb.availableRead === 3, "Available read should decrease after seek");
  assert(rb.readByte() === 3, "Read after seek should return correct byte");
  assert(rb.seek(10) === false, "Seek beyond capacity should fail");
  assert(rb.seek(-1) === false, "Backward seek should fail");

  // Test seekTo
  rb.clear();
  rb.write([1, 2, 3, 4, 5]);
  assert(rb.seekTo(2) === true, "seekTo(2) should succeed");
  assert(rb.availableRead === 3, "Available read should be 3 after seekTo(2)");
  assert(rb.readByte() === 3, "Read after seekTo should return correct byte");
  assert(rb.seekTo(10) === false, "seekTo beyond available data should fail");
  assert(rb.seekTo(-1) === false, "seekTo negative should fail");

  // Test primitive write helpers
  rb.clear();
  rb.resize(10);
  assert(rb.writeUint8(255) === true, "writeUint8 failed");
  assert(rb.writeUint16(0x1234) === true, "writeUint16 failed");
  assert(rb.writeUint32(0xDEADBEEF) === true, "writeUint32 failed");
  
  assert(rb.readUint8() === 255, "Read back writeUint8 mismatch");
  assert(rb.readUint16() === 0x1234, "Read back writeUint16 mismatch");
  assert(rb.readUint32() === 0xDEADBEEF, "Read back writeUint32 mismatch");
  assert(rb.isEmpty(), "Buffer should be empty after reading written primitives");

  // Test float writes and reads
  rb.clear();
  rb.resize(20);
  assert(rb.writeFloat32(1.23) === true, "writeFloat32 failed");
  assert(rb.writeFloat64(4.5678) === true, "writeFloat64 failed");
  
  assert(Math.abs((rb.readFloat32() || 0) - 1.23) < 0.0001, "readFloat32 failed");
  assert(Math.abs((rb.readFloat64() || 0) - 4.5678) < 0.0001, "readFloat64 failed");

  // Test string writes and reads
  rb.clear();
  rb.resize(30);
  const testStr = "Hello 🚀";
  assert(rb.writeString(testStr) === true, "writeString failed");
  const encodedStr = new TextEncoder().encode(testStr);
  assert(rb.readString(encodedStr.length) === testStr, "readString mismatch");
  assert(rb.isEmpty(), "Buffer should be empty after reading string");

  // Test prefixed string writes and reads
  rb.clear();
  rb.resize(60);
  const prefixStr = "Prefixed World";
  assert(rb.writePrefixedString(prefixStr) === true, "writePrefixedString failed");
  assert(rb.readPrefixedString() === prefixStr, "readPrefixedString mismatch");
  assert(rb.isEmpty(), "Buffer should be empty after reading prefixed string");

  // Test boolean writes and reads
  rb.clear();
  assert(rb.writeBoolean(true) === true, "writeBoolean(true) failed");
  assert(rb.writeBoolean(false) === true, "writeBoolean(false) failed");
  assert(rb.readBoolean() === true, "readBoolean(true) mismatch");
  assert(rb.readBoolean() === false, "readBoolean(false) mismatch");
  assert(rb.isEmpty(), "Buffer should be empty after reading booleans");

  // Test iterator
  rb.clear();
  rb.resize(5);
  rb.write([1, 2, 3]);
  const iterated = [...rb];
  assert(iterated.length === 3 && iterated[0] === 1 && iterated[2] === 3, "Iterator failed");
  assert(rb.availableRead === 3, "Iterator should not consume data");

  // Test 64-bit integer writes and reads
  rb.clear();
  rb.resize(20);
  const bigVal = 12345678901234567890n;
  const signedBigVal = -9876543210987654321n;
  assert(rb.writeUint64(bigVal) === true, "writeUint64 failed");
  assert(rb.writeInt64(signedBigVal) === true, "writeInt64 failed");
  assert(rb.readUint64() === bigVal, "readUint64 mismatch");
  assert(rb.readInt64() === signedBigVal, "readInt64 mismatch");
  assert(rb.isEmpty(), "Buffer should be empty after reading 64-bit integers");

  // Test copyFrom
  rb.clear();
  rb.resize(10);
  const src = new RingBuffer(10);
  src.write([1, 2, 3, 4, 5]);
  const copied = rb.copyFrom(src);
  assert(copied === 5, "copyFrom should return number of bytes copied");
  assert(rb.availableRead === 5, "Destination buffer should have 5 bytes");
  assert(src.isEmpty(), "Source buffer should be empty after copyFrom");
  
  src.write([6, 7, 8, 9]);
  const partialCopied = rb.copyFrom(src, 2);
  assert(partialCopied === 2, "Partial copyFrom failed");
  assert(rb.availableRead === 7, "Destination should now have 7 bytes");
  assert(src.availableRead === 2, "Source should still have 2 bytes");

  // Test readAvailable
  rb.clear();
  rb.write([1, 2, 3]);
  const available = rb.readAvailable();
  assert(available.length === 3 && available[0] === 1 && available[2] === 3, "readAvailable failed");
  assert(rb.isEmpty(), "Buffer should be empty after readAvailable");

  // Test slice
  rb.clear();
  rb.resize(10);
  rb.write([1, 2, 3, 4, 5]);
  const sliced = rb.slice(1, 4);
  assert(sliced.length === 3 && sliced[0] === 2 && sliced[2] === 4, "slice mismatch");
  assert(rb.availableRead === 5, "slice should not consume data");

  // Test slice with wrap around
  rb.clear();
  rb.write([1, 2, 3]);
  rb.read(2);
  // readOffset is 2, count is 1
  rb.write([4, 5, 6]);
  // readOffset 2, writeOffset 0, count 4. Data: [3, 4, 5, 6]
  const wrapSliced = rb.slice(1, 4);
  assert(wrapSliced.length === 3 && wrapSliced[0] === 4 && wrapSliced[2] === 6, "wrap slice mismatch");
  
  // Test slice boundaries
  assert(rb.slice(-1, 2).length === 0, "Negative start should return empty");
  assert(rb.slice(10, 12).length === 0, "Start beyond count should return empty");

  // Test boundary cases
  rb.clear();
  assert(rb.write([]) === 0, "Writing empty array should return 0");
  assert(rb.read(0).length === 0, "Reading 0 bytes should return empty array");
  assert(rb.read(100).length === 0, "Reading more than available from empty buffer should return empty array");

  // Test peekView
  rb.clear();
  rb.resize(10);
  rb.write([0, 0, 0, 10]); // Uint32 = 10
  const view = rb.peekView();
  assert(view !== null, "peekView should not be null");
  assert(view.getUint32(0, false) === 10, "peekView read mismatch");
  assert(rb.availableRead === 4, "peekView should not consume data");
  
  rb.clear();
  assert(rb.peekView() === null, "peekView should return null when empty");

  // Test compact
  rb.clear();
  rb.resize(10);
  rb.write([1, 2, 3]);
  rb.read(2); // readOffset = 2, count = 1
  rb.write([4, 5, 6]); // writeOffset = (2+3)%10 = 5, count = 4. Data: [3, 4, 5, 6]
  rb.compact();
  assert(rb.availableRead === 4, "Count should be preserved after compact");
  const compactedData = rb.drain();
  assert(compactedData.length === 4 && compactedData[0] === 3 && compactedData[3] === 6, "Compact data mismatch");
  
  rb.clear();
  rb.compact(); // Compact empty
  assert(rb.isEmpty(), "Empty buffer should stay empty after compact");

  // Test canRead
  rb.clear();
  rb.write([1, 2, 3]);
  assert(rb.canRead(2) === true, "canRead(2) should be true for 3 bytes");
  assert(rb.canRead(3) === true, "canRead(3) should be true for 3 bytes");
  assert(rb.canRead(4) === false, "canRead(4) should be false for 3 bytes");
  assert(rb.canRead(0) === true, "canRead(0) should always be true");

  // Test readInto
  rb.clear();
  rb.write([10, 20, 30, 40, 50]);
  const target = new Uint8Array(3);
  const readCount = rb.readInto(target, 3);
  assert(readCount === 3, "readInto should return 3");
  assert(target[0] === 10 && target[2] === 30, "readInto data mismatch");
  assert(rb.availableRead === 2, "readInto should consume data");

  const targetSmall = new Uint8Array(2);
  const readCountSmall = rb.readInto(targetSmall, 5);
  assert(readCountSmall === 2, "readInto should be limited by target size");
  assert(targetSmall[0] === 40 && targetSmall[1] === 50, "readInto small target mismatch");
  assert(rb.isEmpty(), "readInto should have consumed remaining data");

  // Test readIntoAt
  rb.clear();
  rb.write([10, 20, 30]);
  const targetAt = new Uint8Array(10);
  const readCountAt = rb.readIntoAt(targetAt, 5, 3);
  assert(readCountAt === 3, "readIntoAt should return 3");
  assert(targetAt[5] === 10 && targetAt[7] === 30, "readIntoAt data mismatch");
  assert(rb.isEmpty(), "readIntoAt should consume data");

  // Test readIntoView
  rb.clear();
  rb.write([0, 0, 0, 15]);
  const viewTarget = new DataView(new ArrayBuffer(8));
  const readCountView = rb.readIntoView(viewTarget, 2, 4);
  assert(readCountView === 4, "readIntoView should return 4");
  assert(viewTarget.getUint32(2, false) === 15, "readIntoView data mismatch");
  assert(rb.isEmpty(), "readIntoView should consume data");

  // Test peekExactly
  rb.clear();
  rb.write([1, 2, 3]);
  const peekedExact = rb.peekExactly(2);
  assert(peekedExact !== null && peekedExact.length === 2 && peekedExact[0] === 1 && peekedExact[1] === 2, "peekExactly failed");
  assert(rb.availableRead === 3, "peekExactly should not consume data");
  assert(rb.peekExactly(4) === null, "peekExactly should return null if insufficient data");

  // Test writeExactly
  rb.clear();
  rb.resize(10);
  const srcExact = new Uint8Array([1, 2, 3]);
  assert(rb.writeExactly(srcExact, 3) === true, "writeExactly should succeed");
  assert(rb.availableRead === 3, "writeExactly failed to write data");
  assert(rb.writeExactly(srcExact, 8) === false, "writeExactly should fail if insufficient space");

  // Test writeInto
  rb.clear();
  rb.resize(10);
  const srcInto = new Uint8Array([10, 20, 30, 40, 50]);
  const written = rb.writeInto(srcInto, 1, 3); // Write [20, 30, 40]
  assert(written === 3, "writeInto should write 3 bytes");
  assert(rb.availableRead === 3, "writeInto availableRead mismatch");
  const writtenData = rb.drain();
  assert(writtenData[0] === 20 && writtenData[2] === 40, "writeInto data mismatch");

  // Test peekInto
  rb.clear();
  rb.write([1, 2, 3, 4, 5]);
  const peekTarget = new Uint8Array(3);
  const peekedCount = rb.peekInto(peekTarget, 3);
  assert(peekedCount === 3, "peekInto should return 3");
  assert(peekTarget[0] === 1 && peekTarget[2] === 3, "peekInto data mismatch");
  assert(rb.availableRead === 5, "peekInto should not consume data");

  // Test peekInto wrap around
  rb.clear();
  rb.resize(5);
  rb.write([1, 2, 3]);
  rb.read(2); // readOffset = 2, count = 1. Data: [3]
  rb.write([4, 5, 6]); // readOffset 2, writeOffset 0, count 4. Data: [3, 4, 5, 6]
  const wrapPeekTarget = new Uint8Array(4);
  const wrapPeekedCount = rb.peekInto(wrapPeekTarget, 4);
  assert(wrapPeekedCount === 4, "peekInto wrap should return 4");
  assert(wrapPeekTarget[0] === 3 && wrapPeekTarget[3] === 6, "peekInto wrap data mismatch");
  assert(rb.availableRead === 4, "peekInto wrap should not consume data");

  // Test peekIntoAt
  rb.clear();
  rb.write([10, 20, 30]);
  const peekAtTarget = new Uint8Array(10);
  const peekAtCount = rb.peekIntoAt(peekAtTarget, 5, 3);
  assert(peekAtCount === 3, "peekIntoAt should return 3");
  assert(peekAtTarget[5] === 10 && peekAtTarget[7] === 30, "peekIntoAt data mismatch");
  assert(rb.availableRead === 3, "peekIntoAt should not consume data");

  // Test varints
  rb.clear();
  rb.resize(20);
  assert(rb.writeVarUint(127) === true, "writeVarUint(127) failed");
  assert(rb.writeVarUint(128) === true, "writeVarUint(128) failed");
  assert(rb.writeVarUint(16384) === true, "writeVarUint(16384) failed");
  
  assert(rb.readVarUint() === 127, "readVarUint(127) mismatch");
  assert(rb.readVarUint() === 128, "readVarUint(128) mismatch");
  assert(rb.readVarUint() === 16384, "readVarUint(16384) mismatch");
  assert(rb.isEmpty(), "Buffer should be empty after reading varints");

  console.log("All tests passed!");
}

testRingBuffer();
