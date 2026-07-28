import path from "node:path";

export function staticCacheControl(url, statusCode = 200) {
  const pathname = String(url || "/").split("?")[0];
  if (statusCode >= 400) return "no-store";
  if (pathname === "/" || pathname.endsWith(".html") || !path.extname(pathname)) {
    return "public, max-age=0, must-revalidate";
  }
  if (/^\/assets\/.+-[A-Za-z0-9_-]+\.(?:js|css)$/i.test(pathname)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=300";
}
