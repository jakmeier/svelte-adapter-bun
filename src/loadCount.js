import { promises as fs } from "fs";
import path from "path";
import { env } from "./env.js";


let pageLoads = {};
const dataFolder = env("ACCESS_STATS", "access-stats");
const intervalSeconds = Number(env("STATS_INTERVAL", "3600"));
const latestFile = path.join(dataFolder, "latest.json");

export async function initPageCount() {
  if (!await fs.exists(dataFolder)) {
    await fs.mkdir(dataFolder);
  }

  await restorePageLoads();

  setInterval(exportPageLoads, intervalSeconds * 1000);
}

export function countPageLoads(url) {
  pageLoads[url] = (pageLoads[url] || 0) + 1;
}



/** Read page loads from a file to memory */
async function restorePageLoads() {
  try {
    const data = await fs.readFile(latestFile, "utf-8");
    pageLoads = JSON.parse(data);
    console.log("Restored page loads:", pageLoads);
  } catch (error) {
    console.error("Error reading latest.json. Start counting at zero.", error);
    pageLoads = {};
  }
}

/** Write page loads to a file */
async function exportPageLoads() {
  const now = new Date();
  const fileName = path.join(
    dataFolder,
    `${now.toISOString().split("T")[0]}.json`
  );

  // Read the existing data for today, if any
  let dailyData = [];
  try {
    const existingData = await fs.readFile(fileName, "utf-8");
    dailyData = JSON.parse(existingData);
  } catch (error) {
    console.log("No existing daily data, creating new.");
  }

  // Add a data record for today
  dailyData.push({ timestamp: now.toISOString(), pageLoads: { ...pageLoads } });
  await fs.writeFile(fileName, JSON.stringify(dailyData, null, 2));

  // Update latest for restoration
  await fs.writeFile(latestFile, JSON.stringify(pageLoads, null, 2));
  console.log(`Exported page loads to ${fileName}`);
}

export function pageLoadStatsHandler(path, apiKeyHash) {
  if (!apiKeyHash || apiKeyHash.length < 10) {
    throw new Error("Stats enabled but no API key hash of minimum length 10 define!");
  }
  /**
   * @param {Request} req
  */
  return function (req, next) {
    let pathname = new URL(req.url).pathname;

    if (pathname !== path) {
      return next();
    }

    const key = req.headers.get("Authorization");
    if (key === null) {
      return new Response(
        null,
        { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="stats"' } }
      )
    }

    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(key);
    const hash = hasher.digest("hex");
    if (hash !== apiKeyHash) {
      return new Response(
        null,
        { status: 401 }
      )
    }

    const payload = JSON.stringify(pageLoads);
    if (pageLoads === '{}') {
      return new Response(
        null,
        { status: 503 }
      )

    }

    return new Response(
      payload,
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  };
}
