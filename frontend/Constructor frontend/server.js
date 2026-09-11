import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal server error");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": filePath.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";

  let filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      err = stat ? null : new Error("missing");
    }
    if (err || !stat || !stat.isFile()) {
      if (path.extname(urlPath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 — Not found");
        return;
      }
      filePath = path.join(ROOT, "index.html");
    }
    serveFile(res, filePath);
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error("");
    console.error(`  Port ${PORT} is already in use.`);
    console.error(`  A Nirikshan server is probably still running — try http://localhost:${PORT} in your browser.`);
    console.error("  To use a different port:  set PORT=3001 && npm start");
    console.error("");
    process.exit(1);
  }
  console.error("Server error:", err.message);
  process.exit(1);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500);
});

server.listen(PORT, () => {
  console.log(`NIRIKSHAN Citizen Portal (production build) running at http://localhost:${PORT}`);
});
