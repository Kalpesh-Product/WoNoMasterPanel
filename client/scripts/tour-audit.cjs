const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/routes/Routes.jsx"), "utf8");
const imports = {};
const importRe = /import\s+(\w+)\s+from\s+"(\.[^"]+)"/g;
let m;
while ((m = importRe.exec(src))) imports[m[1]] = m[2];
const elems = new Set();
const elemRe = /element:\s*<([A-Za-z0-9_]+)\s*\/?>/g;
while ((m = elemRe.exec(src))) elems.add(m[1]);
const missing = [];
for (const name of [...elems].sort()) {
  const rel = imports[name];
  if (!rel) continue;
  const base = path.join(root, "src", rel.slice(2));
  let p = null;
  for (const ext of [".jsx", ".js", ".tsx", ".ts", "/index.jsx"]) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) { p = candidate; break; }
  }
  if (!p) continue;
  const t = fs.readFileSync(p, "utf8");
  if (!t.includes("PageFrame") && !t.includes('data-tour="page-content"')) {
    missing.push(name + " -> " + rel);
  }
}
console.log(missing.join("\n"));
console.log("TOTAL MISSING:", missing.length);
