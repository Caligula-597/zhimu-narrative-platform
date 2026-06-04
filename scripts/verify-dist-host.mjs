const base = process.env.UI_BASE_URL || "http://localhost:4173";
const index = await fetch(`${base}/`);
const html = await index.text();
console.log("index", index.status, index.headers.get("content-type"));
console.log("title", html.includes("织幕") ? "ok" : "missing");
const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
if (!jsMatch) {
  console.error("FAIL: no /assets/*.js in index.html");
  process.exit(1);
}
const js = await fetch(`${base}${jsMatch[1]}`);
const css = cssMatch ? await fetch(`${base}${cssMatch[1]}`) : null;
console.log("bundle", jsMatch[1], js.status, `${Math.round((await js.text()).length / 1024)}KB`);
console.log("styles", cssMatch?.[1], css?.status ?? "missing");
if (js.status !== 200 || !css || css.status !== 200) process.exit(1);
console.log("dist-host: ok");
