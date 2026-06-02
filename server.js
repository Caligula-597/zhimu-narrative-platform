const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const mime = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8" };

http.createServer((req,res) => {
  const target = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const file = path.join(root, target);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(4173, () => console.log("织幕已启动：http://localhost:4173"));
