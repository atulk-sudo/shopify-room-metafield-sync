
import fs from "fs";
import csv from "csv-parser";

const inputFile = "input/products.csv";

if (!fs.existsSync(inputFile)) {
  console.error("❌ input/products.csv not found.");
  process.exit(1);
}

const rows = [];

fs.createReadStream(inputFile)
  .pipe(csv())
  .on("data", (row) => {
    rows.push(row);
  })
  .on("end", () => {
    console.log(`✅ Loaded ${rows.length} products.`);

    if (rows.length > 0) {
      console.log("Columns:");
      console.log(Object.keys(rows[0]));
    }
  });
