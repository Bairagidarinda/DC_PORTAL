// File: server/algorithms/lz77.js

function compressLZ77(inputBuffer) {
  const input = inputBuffer.toString("binary");
  const windowSize = 2048;
  const lookaheadSize = 32;

  const output = [];
  let i = 0;

  while (i < input.length) {
    let matchLength = 0,
      matchDistance = 0;

    const end = Math.min(i + lookaheadSize, input.length);
    const lookahead = input.substring(i, end);
    const searchStart = Math.max(0, i - windowSize);
    const searchBuffer = input.substring(searchStart, i);

    for (let j = 0; j < searchBuffer.length; j++) {
      let length = 0;
      while (
        length < lookahead.length &&
        searchBuffer[j + length] === lookahead[length]
      ) {
        length++;
      }
      if (length > matchLength) {
        matchLength = length;
        matchDistance = searchBuffer.length - j;
      }
    }

    const nextChar = input[i + matchLength] || "";
    output.push(`<${matchDistance},${matchLength},${nextChar}>`);
    i += matchLength + 1;
  }

  return Buffer.from(output.join(""), "binary");
}

function decompressLZ77(compressedBuffer) {
  // Check if this is actually an LZ77-compressed file or an original file
  const isLZ77File = isValidLZ77File(compressedBuffer);
  
  if (!isLZ77File) {
    // This appears to be an original file, return as-is to show original statistics
    return compressedBuffer;
  }

  // This is a real LZ77-compressed file - proceed with actual decompression
  return performActualDecompression(compressedBuffer);
}

function isValidLZ77File(buffer) {
  try {
    const compressed = buffer.toString("binary");
    
    // Check if the content follows LZ77 pattern with <distance,length,char> format
    const pattern = /<([0-9]+),([0-9]+),([^>]?)>/g;
    let match;
    let matchCount = 0;
    let totalLength = 0;
    
    // Test if we can find valid LZ77 patterns
    while ((match = pattern.exec(compressed)) !== null) {
      matchCount++;
      totalLength += match[0].length;
      
      // Basic validation of distance and length values
      const distance = parseInt(match[1], 10);
      const length = parseInt(match[2], 10);
      
      // Reasonable bounds check
      if (distance < 0 || distance > 2048 || length < 0 || length > 32) {
        return false;
      }
      
      // If we found some matches, it's likely an LZ77 file
      if (matchCount >= 2) {
        break;
      }
    }
    
    // If we found valid LZ77 patterns and they cover a reasonable portion of the file
    if (matchCount > 0 && totalLength > compressed.length * 0.1) {
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

function performActualDecompression(compressedBuffer) {
  const compressed = compressedBuffer.toString("binary");
  const output = [];
  const pattern = /<([0-9]+),([0-9]+),([^>]?)>/g;
  let match;

  while ((match = pattern.exec(compressed)) !== null) {
    const distance = parseInt(match[1], 10);
    const length = parseInt(match[2], 10);
    const char = match[3];

    // Validate distance
    if (distance > output.length) {
      throw new Error(`Invalid LZ77 distance: ${distance}, output length: ${output.length}`);
    }

    const start = output.length - distance;
    for (let i = 0; i < length; i++) {
      if (start + i < 0 || start + i >= output.length) {
        throw new Error("LZ77 reference out of bounds");
      }
      output.push(output[start + i]);
    }
    if (char) output.push(char);
  }

  return Buffer.from(output.join(""), "binary");
}

module.exports = {
  compressLZ77,
  decompressLZ77,
};