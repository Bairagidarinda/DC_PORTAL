// File: algorithms/huffman.js

class HuffmanNode {
  constructor(char, freq, left = null, right = null) {
    this.char = char;
    this.freq = freq;
    this.left = left;
    this.right = right;
  }
}

function buildFrequencyTable(data, isText) {
  const freqTable = new Map();
  
  if (isText) {
    // For text data, count character frequencies
    for (let char of data) {
      freqTable.set(char, (freqTable.get(char) || 0) + 1);
    }
  } else {
    // For binary data, count byte frequencies
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      freqTable.set(byte, (freqTable.get(byte) || 0) + 1);
    }
  }
  
  return freqTable;
}

function buildHuffmanTree(freqTable) {
  const heap = [];
  
  // Create leaf nodes
  for (let [char, freq] of freqTable) {
    heap.push(new HuffmanNode(char, freq));
  }
  
  // Sort by frequency
  heap.sort((a, b) => a.freq - b.freq);
  
  // Build tree
  while (heap.length > 1) {
    const left = heap.shift();
    const right = heap.shift();
    const merged = new HuffmanNode(null, left.freq + right.freq, left, right);
    
    // Insert back in sorted position
    let inserted = false;
    for (let i = 0; i < heap.length; i++) {
      if (merged.freq <= heap[i].freq) {
        heap.splice(i, 0, merged);
        inserted = true;
        break;
      }
    }
    if (!inserted) heap.push(merged);
  }
  
  return heap[0];
}

function buildCodes(root) {
  const codes = new Map();
  
  function traverse(node, code) {
    if (node.char !== null) {
      codes.set(node.char, code || '0'); // Handle single character case
      return;
    }
    
    if (node.left) traverse(node.left, code + '0');
    if (node.right) traverse(node.right, code + '1');
  }
  
  if (root) traverse(root, '');
  return codes;
}

function compressHuffman(data, isText = true) {
  if (!data || data.length === 0) {
    return { data: Buffer.alloc(0), tree: null, isText: isText };
  }

  // Build frequency table
  const freqTable = buildFrequencyTable(data, isText);
  
  // Handle single character case
  if (freqTable.size === 1) {
    const char = freqTable.keys().next().value;
    const tree = new HuffmanNode(char, freqTable.get(char));
    const compressedBits = '0'.repeat(data.length);
    
    // Convert bits to bytes
    const compressedBytes = bitsToBytes(compressedBits);
    
    // Create header with tree and metadata
    const header = {
      tree: serializeTree(tree),
      originalLength: data.length,
      isText: isText,
      bitsLength: compressedBits.length
    };
    
    const headerBuffer = Buffer.from(JSON.stringify(header));
    const headerSizeBuffer = Buffer.alloc(4);
    headerSizeBuffer.writeUInt32BE(headerBuffer.length, 0);
    
    return {
      data: Buffer.concat([headerSizeBuffer, headerBuffer, compressedBytes])
    };
  }
  
  // Build Huffman tree
  const root = buildHuffmanTree(freqTable);
  const codes = buildCodes(root);
  
  // Encode data
  let compressedBits = '';
  if (isText) {
    for (let char of data) {
      compressedBits += codes.get(char);
    }
  } else {
    for (let i = 0; i < data.length; i++) {
      compressedBits += codes.get(data[i]);
    }
  }
  
  // Convert bits to bytes
  const compressedBytes = bitsToBytes(compressedBits);
  
  // Create header with tree and metadata
  const header = {
    tree: serializeTree(root),
    originalLength: data.length,
    isText: isText,
    bitsLength: compressedBits.length
  };
  
  const headerBuffer = Buffer.from(JSON.stringify(header));
  const headerSizeBuffer = Buffer.alloc(4);
  headerSizeBuffer.writeUInt32BE(headerBuffer.length, 0);
  
  return {
    data: Buffer.concat([headerSizeBuffer, headerBuffer, compressedBytes])
  };
}

function decompressHuffman(compressedBuffer) {
  if (!compressedBuffer || compressedBuffer.length === 0) {
    return Buffer.alloc(0);
  }

  try {
    // Read header size
    const headerSize = compressedBuffer.readUInt32BE(0);
    
    // Read header
    const headerBuffer = compressedBuffer.slice(4, 4 + headerSize);
    const header = JSON.parse(headerBuffer.toString());
    
    // Read compressed data
    const compressedData = compressedBuffer.slice(4 + headerSize);
    
    // Deserialize tree
    const root = deserializeTree(header.tree);
    
    // Convert bytes back to bits
    const bits = bytesToBits(compressedData, header.bitsLength);
    
    // Decode bits using Huffman tree
    const decoded = [];
    let current = root;
    
    for (let bit of bits) {
      if (current.char !== null) {
        // Leaf node reached
        decoded.push(current.char);
        current = root;
      }
      
      if (bit === '0') {
        current = current.left;
      } else {
        current = current.right;
      }
    }
    
    // Handle last character
    if (current && current.char !== null) {
      decoded.push(current.char);
    }
    
    // Convert result based on original data type
    if (header.isText) {
      return Buffer.from(decoded.join(''), 'utf-8');
    } else {
      return Buffer.from(decoded);
    }
    
  } catch (error) {
    throw new Error(`Huffman decompression failed: ${error.message}`);
  }
}

function bitsToBytes(bits) {
  const bytes = [];
  
  // Pad bits to make length multiple of 8
  while (bits.length % 8 !== 0) {
    bits += '0';
  }
  
  for (let i = 0; i < bits.length; i += 8) {
    const byte = parseInt(bits.substr(i, 8), 2);
    bytes.push(byte);
  }
  
  return Buffer.from(bytes);
}

function bytesToBits(buffer, originalBitsLength) {
  let bits = '';
  
  for (let i = 0; i < buffer.length; i++) {
    bits += buffer[i].toString(2).padStart(8, '0');
  }
  
  // Trim to original bits length to remove padding
  return bits.substr(0, originalBitsLength);
}

function serializeTree(node) {
  if (!node) return null;
  
  return {
    char: node.char,
    freq: node.freq,
    left: serializeTree(node.left),
    right: serializeTree(node.right)
  };
}

function deserializeTree(serialized) {
  if (!serialized) return null;
  
  const node = new HuffmanNode(serialized.char, serialized.freq);
  node.left = deserializeTree(serialized.left);
  node.right = deserializeTree(serialized.right);
  
  return node;
}

module.exports = { compressHuffman, decompressHuffman };