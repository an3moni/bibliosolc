import { Application, Router, send } from "jsr:@oak/oak";

const app = new Application();
const router = new Router();

/*
 * API routes
 */

router.get("/api/hello", (ctx) => {
  ctx.response.body = {
    message: "Hello from Deno!"
  };
});

router.get("/api/time", (ctx) => {
  ctx.response.body = {
    time: new Date().toISOString()
  };
});

/*
 * Custom pages
 */

router.get("/", async (ctx) => {
  await send(ctx, "index.html", {
    root: `${Deno.cwd()}/public`,
  });
});

router.get("/about", async (ctx) => {
  await send(ctx, "about.html", {
    root: `${Deno.cwd()}/public`,
  });
});

app.use(router.routes());
app.use(router.allowedMethods());

/*
 * Static files
 */

app.use(async (ctx, next) => {
  try {
    await send(ctx, ctx.request.url.pathname, {
      root: `${Deno.cwd()}/public`,
      index: "index.html",
    });
  } catch {
    await next();
  }
});

console.log("Server running on http://localhost:8000");

await app.listen({ port: 8000 });
