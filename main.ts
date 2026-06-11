import { Application, Router, send } from "jsr:@oak/oak";
const kv = await Deno.openKv();
import * as argon2 from "jsr:@felix/argon2";
import Fuse from "npm:fuse.js";

const HARDCODED_PASSWORD = "$argon2id$v=19$m=4096,t=3,p=1$v2GLiiGP8HYi4sfRpQgchXKH03EShg$tKXOeQTZAgEZHzTgL9AmKIlDNphlSrjZzvd8GHRDNFg";
const entry = await kv.get<string>(["passwords", 0]);
const ADMIN_PASSWORD_HASH = entry.value ?? HARDCODED_PASSWORD;

async function authenticate(password: string): Promise<boolean> {
  return await argon2.verify(ADMIN_PASSWORD_HASH, password);
}

interface Book {
  id: string; // internal UUID
  libraryId: string; // visible tag
  title: string;
  author: string;
  level: number;
  shelfX: number;
  shelfY: number;
}

interface Level {
  n: number;
  name: string;
}

const app = new Application();
const router = new Router();

/*
 * API routes
 */

router.get("/api/listbooks", async (ctx) => {
  const books = [];

  for await (const entry of kv.list<Book>({
    prefix: ["books"],
  })) {
    books.push(entry.value);
  }

  ctx.response.body = books;
});

router.get("/api/building", async (ctx) => {
  const levels = [];

  for await (const entry of kv.list<Level>({
    prefix: ["levels"],
  })) {
    levels.push(entry.value);
  }

  ctx.response.body = levels;
});

router.get("/api/hello", (ctx) => {
  ctx.response.body = {
    message: "Hello from Deno!",
  };
});

router.post("/login", async (ctx) => {
  const body = await ctx.request.body.json();

  const ok = await authenticate(body.password);

  if (!ok) {
    ctx.response.status = 401;
    ctx.response.body = {
      success: false,
    };
    return;
  }

  ctx.response.body = {
    success: true,
  };
});

router.post("/api/changepassword", async (ctx) => {
  const body = await ctx.request.body.json();
  const { newPassword, password } = body;

  if (!password || !newPassword) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Missing required fields",
    };
    return;
  }

  if (!(await authenticate(password))) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: "Authentication failed",
    };
    return;
  }

  await kv.set(["passwords", 0], newPassword);

  ctx.response.body = {
    success: true,
  };
})

router.post("/api/setlevel", async (ctx) => {
  const body = await ctx.request.body.json();
  const { name, number, password } = body;

  if (!password || !name || number === undefined) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Missing required fields",
    };
    return;
  }

  if (!(await authenticate(password))) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: "Authentication failed",
    };
    return;
  }

  const level: Level = {
    n: number,
    name,
  };

  await kv.set(["levels", number], level);

  ctx.response.body = {
    success: true,
    number,
  };
});

router.post("/api/books", async (ctx) => {
  const body = await ctx.request.body.json();

  const { password, libraryId, title, author, level, shelfX, shelfY } = body;

  if (
    !password ||
    !libraryId ||
    !title ||
    !author ||
    level === undefined ||
    shelfX === undefined ||
    shelfY === undefined
  ) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Missing required fields",
    };
    return;
  }

  if (!(await authenticate(password))) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: "Authentication failed",
    };
    return;
  }

  const id = crypto.randomUUID();

  const book = {
    id,
    libraryId,
    title,
    author,
    level,
    shelfX,
    shelfY,
  };

  await kv.set(["books", id], book);

  ctx.response.body = {
    success: true,
    id,
  };
});

router.post("/api/editbooks", async (ctx) => {
  const body = await ctx.request.body.json();

  const {
    password,
    libraryId,
    title,
    author,
    level,
    shelfX,
    shelfY,
    internalId,
  } = body;

  if (
    !password ||
    !libraryId ||
    !title ||
    !author ||
    !internalId ||
    level === undefined ||
    shelfX === undefined ||
    shelfY === undefined
  ) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: "Missing required fields",
    };
    return;
  }

  if (!(await authenticate(password))) {
    ctx.response.status = 401;
    ctx.response.body = {
      error: "Authentication failed",
    };
    return;
  }

  const book = {
    id: internalId,
    libraryId,
    title,
    author,
    level,
    shelfX,
    shelfY,
  };

  await kv.set(["books", internalId], book);

  ctx.response.body = {
    success: true,
    internalId,
  };
});

router.delete("/api/books/:id", async (ctx) => {
  const id = ctx.params.id;

  if (!id) {
    ctx.response.status = 400;
    return;
  }

  const body = await ctx.request.body.json();

  if (!(await authenticate(body.password))) {
    ctx.response.status = 401;
    return;
  }

  await kv.delete(["books", id]);

  ctx.response.body = {
    success: true,
  };
});

router.get("/api/search", async (ctx) => {
  const query = ctx.request.url.searchParams.get("q");

  if (!query) {
    ctx.response.status = 400;
    return;
  }

  const books: Book[] = [];

  for await (const entry of kv.list<Book>({
    prefix: ["books"],
  })) {
    books.push(entry.value);
  }

  const fuse = new Fuse(books, {
    keys: ["title", "author", "libraryId"],
    threshold: 0.4,
    includeScore: true,
  });

  const results = fuse
    .search(query)
    .slice(0, 20)
    .map((r) => r.item);

  ctx.response.body = results;
});

router.get("/api/books/:id", async (ctx) => {
  const id = ctx.params.id;

  const result = await kv.get<Book>(["books", id]);

  if (!result.value) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Not found" };
    return;
  }

  ctx.response.body = result.value;
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
