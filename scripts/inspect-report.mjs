import ExcelJS from "exceljs";

const path = process.argv[2];
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path);

console.log("=== sheets ===");
wb.worksheets.forEach((ws) => console.log(`- ${ws.name} (rows=${ws.rowCount}, cols=${ws.columnCount})`));

const ws = wb.worksheets[0];
console.log("\n=== first 8 rows ===");
let printed = 0;
ws.eachRow({ includeEmpty: true }, (row, rn) => {
  if (printed >= 8) return;
  const cells = [];
  row.eachCell({ includeEmpty: true }, (cell) => {
    let v = cell.value;
    if (v != null && typeof v === "object" && "text" in v) v = v.text;
    cells.push(v == null ? "" : String(v));
  });
  console.log(`[r${rn}] ` + cells.map((c) => JSON.stringify(c)).join(" | "));
  printed++;
});
