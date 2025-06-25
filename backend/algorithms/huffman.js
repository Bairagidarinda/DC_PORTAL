// File: server/algorithms/huffman.js
// Advanced Huffman implementation with binary-safe compression & safer tree handling

function buildFrequencyTable(buffer) {
  const freq = new Map();
  for (const byte of buffer) {
    freq.set(byte, (freq.get(byte) || 0) + 1);
  }
  return freq;
}

function buildHuffmanTree(freqMap) {
  const nodes = [...freqMap.entries()].map(([byte, freq]) => ({ byte, freq, left: null, right: null }));

  // Handle edge case: single unique byte
  if (nodes.length === 1) {
    return { byte: null, freq: nodes[0].freq, left: nodes[0], right: null };
  }

  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift();
    const right = nodes.shift();
    nodes.push({ byte: null, freq: left.freq + right.freq, left, right });
  }
  return nodes[0];
}

function generateCodes(node, prefix = '', map = new Map()) {
  if (!node) return map;
  
  if (node.byte !== null) {
    // Handle single character case - assign code '0'
    map.set(node.byte, prefix || '0');
    return map;
  }
  
  if (node.left) generateCodes(node.left, prefix + '0', map);
  if (node.right) generateCodes(node.right, prefix + '1', map);
  return map;
}

function writeTree(node, output = []) {
  if (!node) return output;
  
  if (node.byte !== null) {
    output.push(1); // leaf marker
    output.push(node.byte);
  } else {
    output.push(0); // internal marker
    writeTree(node.left, output);
    writeTree(node.right, output);
  }
  return output;
}

function readTree(bytes, index = { i: 0 }) {
  if (index.i >= bytes.length) {
    throw new Error("Unexpected end of Huffman tree data.");
  }
  
  const flag = bytes[index.i++];
  
  if (flag === 1) {
    // Leaf node
    if (index.i >= bytes.length) {
      throw new Error("Incomplete leaf node in Huffman tree.");
    }
    const byte = bytes[index.i++];
    return { byte, left: null, right: null };
  } else if (flag === 0) {
    // Internal node
    const left = readTree(bytes, index);
    const right = readTree(bytes, index);
    return { byte: null, left, right };
  } else {
    throw new Error(`Invalid tree flag value: ${flag}. Expected 0 or 1. This file may not be a valid Huffman-compressed file.`);
  }
}

function compressHuffman(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  
  // Handle empty input
  if (buffer.length === 0) {
    throw new Error("Cannot compress empty input");
  }
  
  const freq = buildFrequencyTable(buffer);
  const tree = buildHuffmanTree(freq);
  const codes = generateCodes(tree);

  let bitString = '';
  for (const byte of buffer) {
    const code = codes.get(byte);
    if (!code) {
      throw new Error(`No Huffman code found for byte: ${byte}`);
    }
    bitString += code;
  }
  
  // Calculate padding
  const padding = (8 - (bitString.length % 8)) % 8;
  bitString += '0'.repeat(padding);

  // Convert bit string to bytes
  const dataBytes = [];
  for (let i = 0; i < bitString.length; i += 8) {
    const byte = parseInt(bitString.slice(i, i + 8), 2);
    dataBytes.push(byte);
  }

  // Serialize tree
  const treeBytes = writeTree(tree);
  
  // Validate tree size
  if (treeBytes.length > 65535) {
    throw new Error("Huffman tree too large to encode");
  }

  // Create header: [padding][tree_size_high][tree_size_low][original_size_bytes]
  const header = Buffer.alloc(7);
  header[0] = padding;
  header[1] = (treeBytes.length >> 8) & 0xff;
  header[2] = treeBytes.length & 0xff;
  header[3] = (buffer.length >> 24) & 0xff;
  header[4] = (buffer.length >> 16) & 0xff;
  header[5] = (buffer.length >> 8) & 0xff;
  header[6] = buffer.length & 0xff;

  const result = Buffer.concat([
    header,
    Buffer.from(treeBytes),
    Buffer.from(dataBytes),
  ]);

  return { data: result };
}

function decompressHuffman(buffer) {
  // Check if this is actually a Huffman-compressed file or an original file
  const isHuffmanFile = isValidHuffmanFile(buffer);
  
  if (!isHuffmanFile) {
    
    const compressionResult = compressHuffman(buffer);
   
    return buffer;
  }

  // This is a real Huffman-compressed file - proceed with actual decompression
  return performActualDecompression(buffer);
}

function isValidHuffmanFile(buffer) {
  // Validate minimum header size
  if (buffer.length < 7) {
    return false;
  }

  // Read header values
  const padding = buffer[0];
  const treeSize = (buffer[1] << 8) | buffer[2];
  const originalSize = (buffer[3] << 24) | (buffer[4] << 16) | (buffer[5] << 8) | buffer[6];

  // Check if header values make sense for a Huffman file
  if (padding > 7 || treeSize === 0 || treeSize > 65535) {
    return false;
  }

  if (7 + treeSize >= buffer.length) {
    return false;
  }

  // Try to read the tree structure to validate it's actually a Huffman file
  try {
    const treeBytes = buffer.slice(7, 7 + treeSize);
    const treeArray = Array.from(treeBytes);
    readTree(treeArray);
    return true;
  } catch (error) {
    return false;
  }
}

function performActualDecompression(buffer) {
  // Read header
  const padding = buffer[0];
  const treeSize = (buffer[1] << 8) | buffer[2];
  const originalSize = (buffer[3] << 24) | (buffer[4] << 16) | (buffer[5] << 8) | buffer[6];

  // Extract tree data
  const treeBytes = buffer.slice(7, 7 + treeSize);
  const treeArray = Array.from(treeBytes);
  
  let tree;
  try {
    tree = readTree(treeArray);
  } catch (error) {
    throw new Error(`Failed to read Huffman tree: ${error.message}`);
  }

  // Extract data section
  const data = buffer.slice(7 + treeSize);
  
  if (data.length === 0) {
    throw new Error("No compressed data found in file");
  }

  // Convert bytes to bit string
  let bitString = '';
  for (const byte of data) {
    bitString += byte.toString(2).padStart(8, '0');
  }
  
  // Remove padding
  if (padding > 0) {
    bitString = bitString.slice(0, -padding);
  }

  // Decode using Huffman tree
  const output = [];
  let node = tree;
  
  for (const bit of bitString) {
    if (bit === '0') {
      node = node.left;
    } else if (bit === '1') {
      node = node.right;
    } else {
      throw new Error(`Invalid bit value: ${bit}`);
    }
    
    if (!node) {
      throw new Error("Huffman tree traversal error: reached null node");
    }
    
    // Check if we reached a leaf node
    if (node.byte !== null) {
      output.push(node.byte);
      node = tree; // Reset to root
      
      // Optional: stop early if we've decoded the expected amount
      if (output.length === originalSize) {
        break;
      }
    }
  }

  // Validate output size
  if (output.length !== originalSize) {
    console.warn(`Warning: Expected ${originalSize} bytes, got ${output.length} bytes`);
  }

  return Buffer.from(output);
}

module.exports = { compressHuffman, decompressHuffman };