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
  rb.write([4, 5, 6]); // buffer is [_, _, 3, 4, 5], writeOffset is 2, count is 4 (3 was already there)
  // Wait, rb had [0,0,0,0,0] -> write [1,2,3] -> [1,2,3,0,0] (W=3, R=0, C=3)
  // read 2 -> [1,2,3,0,0] (W=3, R=2, C=1)
  // write [4,5,6] -> [4,5,3,4,5] ? No, let's re-trace.
  // Initial: rb(5), buf[0,0,0,0,0], R=0, W=0, C=0
  // write [1,2,3]: buf[1,2,3,0,0], R=0, W=3, C=3
  // read 2: returns [1,2], buf[1,2,3,0,0], R=2, W=3, C=1
  // write [4,5,6]: 
  // i=0: buf[3]=4, W=4, C=2
  // i=1: buf[4]=5, W=0, C=3
  // i=2: buf[0]=6, W=1, C=4
  // State: buf[6,2,3,4,5], R=2, W=1, C=4
  
  const remaining = rb.read(4);
  assert(remaining[0] === 3 && remaining[1] === 4 && remaining[2] === 5 && remaining[3] === 6, "Wrap around read failed");
  
  console.log("All tests passed!");
}

testRingBuffer();