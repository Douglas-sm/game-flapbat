const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist");

const ENTRIES = ["index.html", "style.css", "js", "assets"];

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const entry of ENTRIES) {
  const source = path.join(ROOT, entry);

  if (!fs.existsSync(source)) {
    continue;
  }

  const destination = path.join(OUT_DIR, entry);
  fs.cpSync(source, destination, { recursive: true });
}

// Copy @vercel/analytics node_modules for analytics support
const analyticsSource = path.join(ROOT, "node_modules", "@vercel");
const analyticsDestination = path.join(OUT_DIR, "node_modules", "@vercel");
if (fs.existsSync(analyticsSource)) {
  fs.mkdirSync(path.dirname(analyticsDestination), { recursive: true });
  fs.cpSync(analyticsSource, analyticsDestination, { recursive: true });
  console.log("Copied @vercel/analytics to dist");
}

console.log(`Static build generated at ${path.relative(ROOT, OUT_DIR)}`);
