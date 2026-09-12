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

  // Test isEmpty/isFull
  assert(rb.isEmpty() === false, "Should not be empty");
  rb.read(2);
  assert(rb.isEmpty() === true, "Should be empty after reading all");
  
  rb.write([1, 2, 3, 4, 5]);
  assert(rb.isFull() === true, "Should be full");
  assert(rb.availableWrite === 0, "Available write should be 0 when full");
  
  console.log("All tests passed!");
}

testRingBuffer();