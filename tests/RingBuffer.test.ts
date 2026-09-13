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
  
  console.log("All tests passed!");
}

testRingBuffer();