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
  const compressed = compressedBuffer.toString("binary");
  const output = [];
  const pattern = /<([0-9]+),([0-9]+),([^>]?)>/g;
  let match;

  while ((match = pattern.exec(compressed)) !== null) {
    const distance = parseInt(match[1], 10);
    const length = parseInt(match[2], 10);
    const char = match[3];

    const start = output.length - distance;
    for (let i = 0; i < length; i++) {
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
