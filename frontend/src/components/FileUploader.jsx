// File: src/components/FileUploader.jsx
import React, { useState } from "react";
import axios from "axios";
import {
  UploadCloud,
  FileText,
  Image,
  HardDrive,
  Download,
} from "lucide-react";
const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function FileUploader() {
  const [file, setFile] = useState(null);
  const [algorithm, setAlgorithm] = useState("huffman");
  const [isCompress, setIsCompress] = useState(true);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    if (
      [
        "txt",
        "json",
        "xml",
        "html",
        "css",
        "js",
        "py",
        "java",
        "cpp",
        "c",
      ].includes(ext)
    ) {
      return <FileText className="text-blue-500" size={20} />;
    } else if (
      ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext)
    ) {
      return <Image className="text-green-500" size={20} />;
    } else {
      return <HardDrive className="text-gray-500" size={20} />;
    }
  };

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setResult(null); // Clear previous results when new file is selected
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("algorithm", algorithm);

    const start = performance.now();
    const endpoint = isCompress ? "/compress" : "/decompress";

    try {
      const res = await axios.post(
  `${backendUrl}${endpoint}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const time = (performance.now() - start).toFixed(2);

      const data = {
        ...res.data,
        filename: file.name,
        algorithm,
        time,
        isCompress,
        timestamp: new Date().toLocaleString(),
        originalFile: file, // Store the original file for download
      };

      setResult(data);
      setHistory([data, ...history.slice(0, 9)]); // Keep only last 10 items
    } catch (err) {
      console.error("Error processing file:", err);
      alert(
        `Error processing file: ${err.response?.data?.error || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result || !result.originalFile) {
      alert("No original file available for download.");
      return;
    }

    // Create a modified filename to indicate the operation performed
    const originalName = result.originalFile.name;
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
    
    const operation = result.isCompress ? 'compressed' : 'decompressed';
    const algorithmName = result.algorithm.toUpperCase();
    const modifiedFilename = `${nameWithoutExt}_${operation}_${algorithmName}${extension}`;

    // Create a download link for the original file with modified name
    const url = URL.createObjectURL(result.originalFile);
    const link = document.createElement("a");
    link.href = url;
    link.download = modifiedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL
    URL.revokeObjectURL(url);
  };

  const algorithms = [
    {
      key: "huffman",
      title: "Huffman Coding",
      description:
        "Optimal for text files with repeated characters. Uses variable-length codes.",
      ratio: "~40-60%",
      bestFor: "Text Files",
    },
    {
      key: "rle",
      title: "Run-Length Encoding",
      description: "Efficient for data with many consecutive identical values.",
      ratio: "~20-80%",
      bestFor: "Images/Repetitive Data",
    },
    {
      key: "lz77",
      title: "LZ77",
      description:
        "Dictionary-based compression. Good general-purpose algorithm.",
      ratio: "~30-70%",
      bestFor: "Binary/Mixed Files",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
        File Compression Tool
      </h1>
      <p className="text-center text-gray-600 mb-8">
        Advanced compression with Huffman, RLE, and LZ77 algorithms
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="border rounded-lg shadow-lg bg-white">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-semibold">Upload Files</h2>
              <p className="text-sm opacity-90">
                Drag and drop files or click to browse
              </p>
            </div>
            <div className="p-6">
              <div className="border-2 border-dashed border-blue-400 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <UploadCloud className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supports text, image, and binary files
                </p>

                {file && (
                  <div className="mb-4 p-3 bg-gray-50 rounded border flex items-center justify-center space-x-3">
                    {getFileIcon(file.name)}
                    <span className="text-sm text-gray-700 font-medium">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>
                )}

                <label className="inline-block cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                  />
                  <span className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                    <UploadCloud size={18} /> Browse Files
                  </span>
                </label>
                <p className="text-xs text-gray-400 mt-2">Max size: 100MB</p>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full bg-blue-600 text-white py-3 mt-6 text-lg rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading
                  ? `${isCompress ? "Compressing" : "Decompressing"}...`
                  : `${isCompress ? "Compress" : "Decompress"} File`}
              </button>
            </div>
          </div>

          {/* Algorithm Selection */}
          <div className="bg-white shadow-lg rounded-lg">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-semibold">Algorithm Selection</h2>
              <p className="text-sm opacity-90">
                Choose your compression algorithm
              </p>
            </div>
            <div className="p-6 space-y-4">
              {algorithms.map((algo) => (
                <div
                  key={algo.key}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                    algorithm === algo.key
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="algorithm"
                      value={algo.key}
                      checked={algorithm === algo.key}
                      onChange={() => setAlgorithm(algo.key)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-lg text-gray-800">
                        {algo.title}
                      </span>
                      <p className="text-sm text-gray-600 mt-1">
                        {algo.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">Best for:</span>{" "}
                        {algo.bestFor} |
                        <span className="font-medium"> Avg ratio:</span>{" "}
                        {algo.ratio}
                      </p>
                    </div>
                  </label>
                </div>
              ))}

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setIsCompress(true)}
                  className={`flex-1 py-3 rounded font-medium transition-colors ${
                    isCompress
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Compress Files
                </button>
                <button
                  onClick={() => setIsCompress(false)}
                  className={`flex-1 py-3 rounded font-medium transition-colors ${
                    !isCompress
                      ? "bg-orange-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Decompress Files
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Compression Stats */}
          <div className="bg-white shadow-lg rounded-lg">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-semibold">Processing Results</h2>
            </div>
            <div className="p-6">
              {result ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    {getFileIcon(result.filename)}
                    <span className="font-medium text-gray-800">
                      {result.filename}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">
                        Algorithm:
                      </span>
                      <p className="text-gray-800 capitalize">
                        {result.algorithm}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">
                        Operation:
                      </span>
                      <p
                        className={`font-medium ${
                          result.isCompress
                            ? "text-green-600"
                            : "text-orange-600"
                        }`}
                      >
                        {result.isCompress ? "Compression" : "Decompression"}
                      </p>
                    </div>

                    {result.originalSize && (
                      <div>
                        <span className="font-medium text-gray-600">
                          Original Size:
                        </span>
                        <p className="text-gray-800">
                          {formatFileSize(result.originalSize)}
                        </p>
                      </div>
                    )}

                    {result.compressedSize && (
                      <div>
                        <span className="font-medium text-gray-600">
                          Compressed Size:
                        </span>
                        <p className="text-gray-800">
                          {formatFileSize(result.compressedSize)}
                        </p>
                      </div>
                    )}

                    {result.ratio && (
                      <div>
                        <span className="font-medium text-gray-600">
                          Compression Ratio:
                        </span>
                        <p className="text-gray-800 font-medium">
                          {result.ratio}
                        </p>
                      </div>
                    )}

                    <div>
                      <span className="font-medium text-gray-600">
                        Processing Time:
                      </span>
                      <p className="text-gray-800">{result.time} ms</p>
                    </div>
                  </div>

                  <button
                    onClick={handleDownload}
                    className="w-full mt-4 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download size={18} />
                    <span>Download File</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <FileText size={48} className="mx-auto" />
                  </div>
                  <p className="text-gray-500">
                    No processing results available
                  </p>
                  <p className="text-sm text-gray-400">
                    Upload and process a file to see statistics
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          <div className="bg-white shadow-lg rounded-lg">
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-xl font-semibold">Processing History</h2>
              <p className="text-sm opacity-90">Recent compression jobs</p>
            </div>
            <div className="p-6">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    <HardDrive size={48} className="mx-auto" />
                  </div>
                  <p className="text-gray-500">No processing history yet</p>
                  <p className="text-sm text-gray-400">
                    Your recent operations will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {history.map((item, i) => (
                    <div
                      key={i}
                      className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getFileIcon(item.filename)}
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {item.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.isCompress ? "Compressed" : "Decompressed"}{" "}
                              with {item.algorithm.toUpperCase()}
                              {item.ratio && ` (${item.ratio})`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{item.time}ms</p>
                          <p className="text-xs text-gray-400">
                            {item.timestamp}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}