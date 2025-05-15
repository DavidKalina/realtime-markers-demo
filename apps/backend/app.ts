import "reflect-metadata";
import { Hono } from "hono";
import { emojisRouter } from "./routes/emojis";

const app = new Hono();

// Mount emoji routes
app.route("/api/emojis", emojisRouter);

export default app;
