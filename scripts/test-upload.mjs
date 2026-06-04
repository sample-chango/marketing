import { readFileSync } from "node:fs";

const path = process.argv[2];
const category = process.argv[3] ?? "wallpaper";
const fileName = path.split(/[\\/]/).pop();
const buf = readFileSync(path);

const fd = new FormData();
fd.append("category", category);
fd.append(
  "file",
  new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }),
  fileName,
);

const res = await fetch("http://localhost:3000/api/upload", {
  method: "POST",
  body: fd,
});
console.log("HTTP", res.status);
console.log(JSON.stringify(await res.json(), null, 2));
