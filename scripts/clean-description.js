import fs from "fs";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import { htmlToText } from "html-to-text";

const inputFile = "input/products.csv";
const outputFile = "output/products-clean.csv";

if (!fs.existsSync(inputFile)) {
  console.error("❌ input/products.csv not found.");
  process.exit(1);
}

if (!fs.existsSync("output")) {
  fs.mkdirSync("output");
}

const rows = [];

fs.createReadStream(inputFile)
  .pipe(csv())
  .on("data", (row) => {
    if (row["Body (HTML)"]) {
      let description = htmlToText(row["Body (HTML)"], {
  wordwrap: false,
}).trim();

// Remove everything from "Repeat:" onward
description = description.replace(/\n*\s*Repeat:\s*[\s\S]*$/i, "").trim();

row["Body (HTML)"] = description;
    }

    rows.push(row);
  })
  .on("end", async () => {
    if (rows.length === 0) {
      console.log("No products found.");
      return;
    }

    const headers = Object.keys(rows[0]).map((key) => ({
      id: key,
      title: key,
    }));

    const csvWriter = createObjectCsvWriter({
      path: outputFile,
      header: headers,
    });

    await csvWriter.writeRecords(rows);

    console.log(`✅ ${rows.length} products processed.`);
    console.log(`✅ Output saved to ${outputFile}`);
  });
