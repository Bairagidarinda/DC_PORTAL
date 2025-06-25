const fs = require("fs");

let str = "";
for (let i = 0; i < 10000; i++) {
  str += "AAAAABBBBCCCCDDDDDEEEEE\n";
  str += "The quick brown fox jumps over the lazy dog.\n";
  str += "HELLOHELLOHELLOHELLO\n";
  str += "12345123451234512345\n";
}

fs.writeFileSync("sample.txt", str);
console.log("Large sample.txt created ✅");
