// File: server/algorithms/rle.js
// Advanced RLE implementation with binary-safe compression & escape sequences

const MAX_RUN_LENGTH = 255;
const MIN_RUN_LENGTH = 3;
const ESCAPE_BYTE = 0xFF; // Escape sequence marker

function compressRLE(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  
  // Handle empty input
  if (buffer.length === 0) {
    throw new Error("Cannot compress empty input");
  }
  
  const compressed = [];
  let position = 0;
  
  while (position < buffer.length) {
    const currentByte = buffer[position];
    let runLength = 1;
    
    // Count consecutive identical bytes
    while (position + runLength < buffer.length && 
           buffer[position + runLength] === currentByte && 
           runLength < MAX_RUN_LENGTH) {
      runLength++;
    }
    
    if (runLength >= MIN_RUN_LENGTH) {
      // Encode as run: [ESCAPE_BYTE][byte_value][run_length]
      compressed.push(ESCAPE_BYTE);
      compressed.push(currentByte);
      compressed.push(runLength);
      position += runLength;
    } else {
      // Handle single bytes or short runs
      for (let i = 0; i < runLength; i++) {
        const byte = buffer[position + i];
        if (byte === ESCAPE_BYTE) {
          // Escape the escape byte: [ESCAPE_BYTE][ESCAPE_BYTE][1]
          compressed.push(ESCAPE_BYTE);
          compressed.push(ESCAPE_BYTE);
          compressed.push(1);
        } else {
          // Regular literal byte
          compressed.push(byte);
        }
      }
      position += runLength;
    }
  }
  
  // Create header: [original_size_bytes][rle_marker][escape_byte]
  const header = Buffer.alloc(6);
  header[0] = (buffer.length >> 24) & 0xff;
  header[1] = (buffer.length >> 16) & 0xff;
  header[2] = (buffer.length >> 8) & 0xff;
  header[3] = buffer.length & 0xff;
  header[4] = 0xE1; // RLE marker (Run Length Encoding)
  header[5] = ESCAPE_BYTE;
  
  const result = Buffer.concat([
    header,
    Buffer.from(compressed)
  ]);
  
  return { data: result };
}

function decompressRLE(buffer) {
  // Check if this is actually an RLE-compressed file
  const isRLEFile = isValidRLEFile(buffer);
  
  if (!isRLEFile) {
    // This appears to be an original file, return as-is
    return buffer;
  }
  
  // This is a real RLE-compressed file - proceed with decompression
  return performActualDecompression(buffer);
}

function isValidRLEFile(buffer) {
  // Validate minimum header size
  if (buffer.length < 6) {
    return false;
  }
  
  // Check for RLE marker
  if (buffer[4] !== 0xE1) {
    return false;
  }
  
  const originalSize = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
  const escapeByteUsed = buffer[5];
  
  // Basic sanity checks
  if (originalSize === 0 || originalSize > 100 * 1024 * 1024) { // Max 100MB
    return false;
  }
  
  if (buffer.length < 7) { // Must have at least some compressed data
    return false;
  }
  
  // Validate escape byte is reasonable (not necessarily 0xFF, but should be valid)
  if (escapeByteUsed < 0 || escapeByteUsed > 255) {
    return false;
  }
  
  return true;
}

function performActualDecompression(buffer) {
  // Read header
  const originalSize = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
  const escapeByteUsed = buffer[5];
  
  // Extract compressed data
  const compressed = buffer.slice(6);
  const output = [];
  let position = 0;
  
  while (position < compressed.length && output.length < originalSize) {
    const currentByte = compressed[position];
    
    if (currentByte === escapeByteUsed) {
      // This is an escape sequence
      if (position + 2 >= compressed.length) {
        throw new Error("Incomplete RLE escape sequence");
      }
      
      const dataByte = compressed[position + 1];
      const runLength = compressed[position + 2];
      
      // Validate run length
      if (runLength === 0) {
        throw new Error("Invalid RLE run length: 0");
      }
      
      if (runLength > MAX_RUN_LENGTH) {
        throw new Error(`Invalid RLE run length: ${runLength}, maximum allowed: ${MAX_RUN_LENGTH}`);
      }
      
      // Add the run to output
      for (let i = 0; i < runLength && output.length < originalSize; i++) {
        output.push(dataByte);
      }
      
      position += 3;
    } else {
      // Regular literal byte
      output.push(currentByte);
      position++;
    }
  }
  
  // Validate output size
  if (output.length !== originalSize) {
    console.warn(`Warning: Expected ${originalSize} bytes, got ${output.length} bytes`);
  }
  
  return Buffer.from(output);
}

// Additional utility function for analyzing RLE efficiency
function analyzeRLEEfficiency(buffer) {
  const analysis = {
    totalBytes: buffer.length,
    runs: 0,
    longestRun: 0,
    averageRunLength: 0,
    potentialSavings: 0
  };
  
  if (buffer.length === 0) {
    return analysis;
  }
  
  let position = 0;
  let totalRunLength = 0;
  
  while (position < buffer.length) {
    const currentByte = buffer[position];
    let runLength = 1;
    
    // Count consecutive identical bytes
    while (position + runLength < buffer.length && 
           buffer[position + runLength] === currentByte && 
           runLength < MAX_RUN_LENGTH) {
      runLength++;
    }
    
    if (runLength >= MIN_RUN_LENGTH) {
      analysis.runs++;
      totalRunLength += runLength;
      analysis.longestRun = Math.max(analysis.longestRun, runLength);
      
      // Each run saves (runLength - 3) bytes (3 bytes for escape sequence)
      analysis.potentialSavings += Math.max(0, runLength - 3);
    }
    
    position += runLength;
  }
  
  analysis.averageRunLength = analysis.runs > 0 ? totalRunLength / analysis.runs : 0;
  analysis.compressionRatio = analysis.totalBytes > 0 ? 
    (analysis.totalBytes - analysis.potentialSavings) / analysis.totalBytes : 1;
  
  return analysis;
}

module.exports = { 
  compressRLE, 
  decompressRLE, 
  analyzeRLEEfficiency 
};