#!/usr/bin/env node

const siteOrigin = (process.env.SITE_PUBLIC_URL || "https://getzhimu.com").replace(/\/$/, "");
const wwwOrigin = (process.env.SITE_WWW_URL || "https://www.getzhimu.com").replace(/\/$/, "");
const appOrigin = (process.env.APP_PUBLIC_URL || "https://app.getzhimu.com").replace(/\/$/, "");
const playOrigin = (process.env.PLAY_SITE_URL || "https://play.getzhimu.com").replace(/\/$/, "");
const hostOrigin = (process.env.HOST_SITE_URL || "https://host.getzhimu.com").replace(/\/$/, "");
const key = "4ae3984d5a13c690ca674a0fc1185a8c";

async function request(url, options = {}) {
  return fetch(url, {
    redirect: options.redirect || "follow",
    signal: AbortSignal.timeout(15_000)
  });
}

function requireMatch(value, pattern, message) {
  if (!pattern.test(value)) throw new Error(message);
}

const homeResponse = await request(`${siteOrigin}/`);
if (!homeResponse.ok) throw new Error(`Homepage returned ${homeResponse.status}`);
const home = await homeResponse.text();
requireMatch(home, /<link rel="canonical" href="https:\/\/getzhimu\.com\/" \/>/, "Homepage canonical is missing or incorrect");
requireMatch(home, /<meta name="robots" content="index, follow,[^"]+" \/>/, "Homepage is not explicitly indexable");
requireMatch(home, /<script type="application\/ld\+json">[\s\S]+"@type": "WebSite"/, "Homepage WebSite structured data is missing");

const wwwResponse = await request(`${wwwOrigin}/`, { redirect: "manual" });
if (![301, 308].includes(wwwResponse.status)) {
  throw new Error(`www must permanently redirect to the canonical host; received ${wwwResponse.status}`);
}
const wwwLocation = new URL(wwwResponse.headers.get("location") || "", `${wwwOrigin}/`);
if (wwwLocation.origin !== siteOrigin) throw new Error(`www redirects to the wrong origin: ${wwwLocation.href}`);

const [sitemapResponse, robotsResponse, keyResponse, appResponse, playRobotsResponse, hostRobotsResponse] = await Promise.all([
  request(`${siteOrigin}/sitemap.xml`),
  request(`${siteOrigin}/robots.txt`),
  request(`${siteOrigin}/${key}.txt`),
  request(`${appOrigin}/`),
  request(`${playOrigin}/robots.txt`),
  request(`${hostOrigin}/robots.txt`)
]);

const [sitemap, robots, publishedKey, appHome, playRobots, hostRobots] = await Promise.all([
  sitemapResponse.text(),
  robotsResponse.text(),
  keyResponse.text(),
  appResponse.text(),
  playRobotsResponse.text(),
  hostRobotsResponse.text()
]);

if (!sitemapResponse.ok || !robotsResponse.ok || !keyResponse.ok) throw new Error("One or more public SEO discovery files are unavailable");
requireMatch(sitemap, /<loc>https:\/\/getzhimu\.com\/<\/loc>/, "Canonical homepage is missing from sitemap");
if (/pricing-commercial|\.html<\/loc>/.test(sitemap)) throw new Error("Sitemap contains redirected or non-indexable URLs");
requireMatch(robots, /Sitemap: https:\/\/getzhimu\.com\/sitemap\.xml/, "robots.txt does not advertise the canonical sitemap");
if (publishedKey.trim() !== key) throw new Error("Published IndexNow key does not match the submission key");

const appRobotsHeader = appResponse.headers.get("x-robots-tag") || "";
if (!/noindex/i.test(appRobotsHeader) && !/<meta name="robots" content="[^"]*noindex/i.test(appHome)) {
  throw new Error("Creator application is missing noindex protection");
}
requireMatch(playRobots, /User-agent: \*\s+Disallow: \//i, "Player surface must remain blocked from search crawling");
requireMatch(hostRobots, /User-agent: \*\s+Disallow: \//i, "Host surface must remain blocked from search crawling");

console.log("Live SEO verification passed: canonical site is discoverable and private surfaces remain excluded.");
