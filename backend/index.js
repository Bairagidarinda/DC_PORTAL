// File: server/index.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { compressHuffman, decompressHuffman } = require("./algorithms/huffman");
const { compressRLE, decompressRLE } = require("./algorithms/rle");
const { compressLZ77, decompressLZ77 } = require("./algorithms/lz77");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Helper function to determine if file is text
function isTextFile(buffer) {
  // Simple heuristic: check if most bytes are printable ASCII
  let textBytes = 0;
  const sampleSize = Math.min(1000, buffer.length);
  
  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i];
    if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
      textBytes++;
    }
  }
  
  return textBytes / sampleSize > 0.7;
}

app.post("/compress", upload.single("file"), async (req, res) => {
  const algo = req.body.algorithm;
  const originalPath = req.file.path;
  const buffer = fs.readFileSync(originalPath);
  const originalFilename = req.file.originalname;
  const fileExtension = path.extname(originalFilename);

  let compressed, compressedPath;
  
  try {
    if (algo === "huffman") {
      // Huffman works with text, so convert to string if it's a text file
      const isText = isTextFile(buffer);
      const input = isText ? buffer.toString("utf-8") : buffer;
      compressed = compressHuffman(input, isText);
      
      compressedPath = `${originalPath}.huffman`;
      // Write as buffer to preserve binary data
      fs.writeFileSync(compressedPath, compressed.data);
      
    } else if (algo === "rle") {
      // RLE can work with both text and binary
      const isText = isTextFile(buffer);
      const input = isText ? buffer.toString("utf-8") : buffer;
      compressed = compressRLE(input, isText);
      
      compressedPath = `${originalPath}.rle`;
      fs.writeFileSync(compressedPath, compressed.data);
      
    } else if (algo === "lz77") {
      // LZ77 works directly with binary data
      compressed = compressLZ77(buffer);
      compressedPath = `${originalPath}.lz77`;
      fs.writeFileSync(compressedPath, compressed);
      
    } else {
      return res.status(400).send("Unsupported algorithm");
    }

    const compressedSize = fs.statSync(compressedPath).size;
    const compressionRatio = (compressedSize / buffer.length * 100).toFixed(2);

    res.json({
      downloadPath: path.basename(compressedPath),
      originalSize: buffer.length,
      compressedSize: compressedSize,
      ratio: compressionRatio + "%",
      originalFilename: originalFilename,
      algorithm: algo,
      message: "File compressed successfully.",
    });

  } catch (error) {
    console.error("Compression error:", error);
    res.status(500).json({ error: "Compression failed: " + error.message });
  }
});

app.post("/decompress", upload.single("file"), async (req, res) => {
  const algo = req.body.algorithm;
  const originalPath = req.file.path;
  const buffer = fs.readFileSync(originalPath);
  const originalFilename = req.file.originalname;

  // Generate decompressed filename by removing compression extension
  let decompressedFilename = originalFilename;
  if (originalFilename.endsWith(`.${algo}`)) {
    decompressedFilename = originalFilename.slice(0, -(algo.length + 1));
  } else {
    decompressedFilename = originalFilename + ".decompressed";
  }
  
  const decompressedPath = path.join(path.dirname(originalPath), 
    path.basename(originalPath) + "_" + decompressedFilename);

  try {
    let decompressed;

    if (algo === "huffman") {
      decompressed = decompressHuffman(buffer);
      
    } else if (algo === "rle") {
      decompressed = decompressRLE(buffer);
      
    } else if (algo === "lz77") {
      decompressed = decompressLZ77(buffer);
      
    } else {
      return res.status(400).send("Unsupported algorithm");
    }

    // Write decompressed data as buffer to preserve binary data
    fs.writeFileSync(decompressedPath, decompressed);

    const decompressedSize = fs.statSync(decompressedPath).size;

    res.json({
      downloadPath: path.basename(decompressedPath),
      decompressedSize: decompressedSize,
      originalFilename: decompressedFilename,
      algorithm: algo,
      message: "File decompressed successfully.",
    });

  } catch (error) {
    console.error("Decompression error:", error);
    res.status(500).json({ error: "Decompression failed: " + error.message });
  }
});

// Serve files for download with proper headers
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, "uploads", filename);
  
  if (!fs.existsSync(filepath)) {
    return res.status(404).send("File not found");
  }

  // Set proper headers for file download
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  
  // Stream the file
  const fileStream = fs.createReadStream(filepath);
  fileStream.pipe(res);
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));