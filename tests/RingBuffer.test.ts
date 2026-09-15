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

  console.log("All tests passed!");
}

testRingBuffer();