import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT ?? 8080);

app.listen(port, () => {
  // Keep startup logging simple until structured logging is added.
  console.log(`API listening on port ${port}`);
});
