/*! MIT © Volodymyr Palamar https://github.com/gornostay25/svelte-adapter-bun */
import { serve } from "bun";
import { build_options, env } from "./env.js";
import handler from "./handler.js";
import { initPageCount, countPageLoads } from "./loadCount.js";

const hostname = env("HOST", "0.0.0.0");
const port = parseInt(env("PORT", 3000));

const { httpserver, websocket } = handler(build_options.assets ?? true, build_options.exposeStats ?? false);

await initPageCount();

const serverOptions = {
  baseURI: env("ORIGIN", undefined),
  // fetch: async ,httpserver
  async fetch(req, srv) {
    countPageLoads(req.url);
    return await httpserver(req, srv);
  },
  hostname,
  port,
  development: env("SERVERDEV", build_options.development ?? false),
  error(error) {
    console.error(error);
    return new Response("Uh oh!!", { status: 500 });
  },
};

websocket ? (serverOptions.websocket = websocket) : 0;

console.info(`Listening on ${hostname + ":" + port}` + (websocket ? " (Websocket)" : ""));
serve(serverOptions);
