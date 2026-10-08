// Minimal node:http webhook receiver using verifyWebhook.
// Run after `npm run build`:
//   WEBHOOK_SECRET=dev_secret node examples/webhook-server.mjs
//   node examples/webhook-server.mjs --self-test   (starts, sends a signed request, exits)
import { createServer } from "node:http";
import { signWebhook, verifyWebhook } from "@olalde/remesa/webhooks";

const secret = process.env.WEBHOOK_SECRET ?? "dev_secret";

const server = createServer((req, res) => {
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    const result = verifyWebhook({
      payload: body, // raw body: never re-serialize parsed JSON before verifying
      signature: req.headers["x-signature"],
      timestamp: req.headers["x-timestamp"],
      secret,
    });
    if (!result.ok) {
      res.writeHead(401).end(result.error.code);
      return;
    }
    res.writeHead(200).end("ok");
  });
});

server.listen(0, async () => {
  const { port } = server.address();
  console.log(`Listening on http://localhost:${port}`);
  if (!process.argv.includes("--self-test")) return;

  const payload = JSON.stringify({ type: "payout.settled", id: "evt_123" });
  const { signature, timestamp } = signWebhook({ payload, secret });
  const send = (sig) =>
    fetch(`http://localhost:${port}`, {
      method: "POST",
      headers: { "x-signature": sig, "x-timestamp": timestamp },
      body: payload,
    }).then(async (r) => `${r.status} ${await r.text()}`);

  console.log("valid signature   →", await send(signature));
  console.log(
    "tampered signature →",
    await send(`${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`),
  );
  server.close();
});
