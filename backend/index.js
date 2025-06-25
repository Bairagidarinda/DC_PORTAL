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
    if (
      (byte >= 32 && byte <= 126) ||
      byte === 9 ||
      byte === 10 ||
      byte === 13
    ) {
      textBytes++;
    }
  }

  return textBytes / sampleSize > 0.7;
}

// Helper function to get file extension
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

// Helper function to remove compression extension
function removeCompressionExtension(filename, algorithm) {
  const compressionExts = [".huffman", ".rle", ".lz77"];
  const ext = path.extname(filename);

  if (compressionExts.includes(ext)) {
    return filename.slice(0, -ext.length);
  }
  return filename;
}

app.post("/compress", upload.single("file"), async (req, res) => {
  const algo = req.body.algorithm;
  const originalPath = req.file.path;
  const buffer = fs.readFileSync(originalPath);
  const originalFilename = req.file.originalname;
  const fileExtension = path.extname(originalFilename);

  // Store original filename and extension for proper download
  const compressedFilename = `${originalFilename}.${algo}`;
  const metadata = {
    originalFilename: originalFilename,
    originalExtension: fileExtension,
    algorithm: algo,
    isText: isTextFile(buffer),
  };

  let compressed, compressedPath;

  try {
    if (algo === "huffman") {
      // Huffman works with text, so convert to string if it's a text file
      const isText = isTextFile(buffer);
      const input = isText ? buffer.toString("utf-8") : buffer;
      compressed = compressHuffman(input, isText);

      compressedPath = path.join(
        path.dirname(originalPath),
        compressedFilename
      );
      // Write as buffer to preserve binary data
      fs.writeFileSync(compressedPath, compressed.data);
    } else if (algo === "rle") {
      // RLE can work with both text and binary
      const isText = isTextFile(buffer);
      const input = isText ? buffer.toString("utf-8") : buffer;
      compressed = compressRLE(input, isText);

      compressedPath = path.join(
        path.dirname(originalPath),
        compressedFilename
      );
      fs.writeFileSync(compressedPath, compressed.data);
    } else if (algo === "lz77") {
      // LZ77 works directly with binary data
      compressed = compressLZ77(buffer);
      compressedPath = path.join(
        path.dirname(originalPath),
        compressedFilename
      );
      fs.writeFileSync(compressedPath, compressed);
    } else {
      return res.status(400).send("Unsupported algorithm");
    }

    // Write metadata file for proper decompression
    const metadataPath = compressedPath + ".meta";
    fs.writeFileSync(metadataPath, JSON.stringify(metadata));

    const compressedSize = fs.statSync(compressedPath).size;
    const compressionRatio = ((compressedSize / buffer.length) * 100).toFixed(
      2
    );

    res.json({
      downloadPath: path.basename(compressedPath),
      originalSize: buffer.length,
      compressedSize: compressedSize,
      ratio: compressionRatio + "%",
      originalFilename: compressedFilename,
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
  const uploadedFilename = req.file.originalname;

  // Try to read metadata file first
  let metadata = null;
  const possibleMetadataPath = path.join(
    path.dirname(originalPath),
    uploadedFilename + ".meta"
  );

  // Generate decompressed filename
  let decompressedFilename = removeCompressionExtension(uploadedFilename, algo);

  // If no extension after removing compression extension, try to restore from metadata
  if (
    !path.extname(decompressedFilename) &&
    metadata &&
    metadata.originalExtension
  ) {
    decompressedFilename += metadata.originalExtension;
  }

  const decompressedPath = path.join(
    path.dirname(originalPath),
    "decompressed_" + decompressedFilename
  );

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

    // Get file sizes for statistics
    const compressedSize = buffer.length; // Size of the compressed file that was uploaded
    const decompressedSize = fs.statSync(decompressedPath).size; // Size after decompression
    
    // Calculate compression ratio (how much the original was compressed)
    const compressionRatio = ((compressedSize / decompressedSize) * 100).toFixed(2);
    
    // Calculate space saved
    const spaceSaved = decompressedSize - compressedSize;
    const spaceSavedPercentage = (((decompressedSize - compressedSize) / decompressedSize) * 100).toFixed(2);

    res.json({
      downloadPath: path.basename(decompressedPath),
      originalSize: decompressedSize, // The decompressed size is the original size
      compressedSize: compressedSize, // The uploaded file size was the compressed size
      decompressedSize: decompressedSize,
      ratio: compressionRatio + "%",
      spaceSaved: spaceSaved,
      spaceSavedPercentage: spaceSavedPercentage + "%",
      originalFilename: decompressedFilename,
      algorithm: algo,
      message: "File decompressed successfully.",
    });
  } catch (error) {
    console.error("Decompression error:", error);
    res.status(500).json({ error: "Decompression failed: " + error.message });
  }
});

// Serve files for download with proper headers and MIME types
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, "uploads", filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).send("File not found");
  }

  // Determine proper MIME type based on file extension
  const ext = path.extname(filename).toLowerCase();
  let mimeType = "application/octet-stream"; // Default binary

  // Set appropriate MIME types
  const mimeTypes = {
    ".txt": "text/plain",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".rar": "application/x-rar-compressed",
    ".7z": "application/x-7z-compressed",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  if (mimeTypes[ext]) {
    mimeType = mimeTypes[ext];
  }

  // Set proper headers for file download
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", fs.statSync(filepath).size);

  // Stream the file
  const fileStream = fs.createReadStream(filepath);
  fileStream.on("error", (err) => {
    console.error("File stream error:", err);
    res.status(500).send("Error reading file");
  });

  fileStream.pipe(res);
});

// Clean up old files periodically (optional)
const cleanupOldFiles = () => {
  const uploadsDir = path.join(__dirname, "uploads");
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  fs.readdir(uploadsDir, (err, files) => {
    if (err) return;

    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting old file:", err);
          });
        }
      });
    });
  });
};

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);

const PORT = 4000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
