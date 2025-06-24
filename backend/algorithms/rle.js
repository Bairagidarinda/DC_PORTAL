function compressRLE(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  let result = [];
  for (let i = 0; i < buffer.length; i++) {
    let count = 1;
    while (
      i < buffer.length - 1 &&
      buffer[i] === buffer[i + 1] &&
      count < 255
    ) {
      count++;
      i++;
    }
    result.push(buffer[i], count);
  }
  return { data: Buffer.from(result) };
}

function decompressRLE(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  let result = [];
  for (let i = 0; i < buffer.length; i += 2) {
    const byte = buffer[i];
    const count = buffer[i + 1];
    for (let j = 0; j < count; j++) {
      result.push(byte);
    }
  }
  return Buffer.from(result);
}

module.exports = { compressRLE, decompressRLE };
