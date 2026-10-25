# City Signal — live signal + social fit

## Run
Install Node.js 20 or newer. In this folder run `npm start`, then open http://localhost:3000.

**Operator demo login:** username `crow`, password `2348`.

## Deployment
Deploy this entire folder to a Node.js host with a **persistent writable disk**. Set `PORT` if required. Set `CROW_USER` and `CROW_PASSWORD` environment variables to change the credentials. Use HTTPS and protect the server. `observations.json` is created automatically and must be stored on persistent disk. `DATA_FILE` can point to a persistent volume. A static GitHub Pages deployment cannot run this backend.

**Security:** The requested 2348 password is a public demo credential, not production security. Change it before deploying. The built-in session/login system is a small prototype; for real public usage, use a managed authentication service, audited access controls, rate limiting at the proxy, and durable managed storage.

## What is real and what is not
- Operator-submitted aggregate headcounts are **observations**, not automated sensor readings. Each is stored with a server timestamp and source.
- Server-sent events (SSE) broadcast updates to all connected browsers. No visitor voting.
- Current reports become stale after **24 hours**. Stale is displayed as **unknown**, not zero. Historical aggregate observations remain saved for calibration.
- Simulator continues independently; it pauses 5 seconds after a new report and recalibrates. The learning algorithm uses the median ratio of observed to baseline counts, bounded to prevent wild adjustments, plus recent-observation decay.
- The 300 signal scale is a visual comparison scale, not a certified venue limit.
- Venue theoretical maximums are **2× previous midpoint estimates**: 90→180, 105→210, 160→320, 58→116, 65→130, 160→320. The last three are explicitly placeholders until venue identities can be verified.
- Stage prices are **hypothetical package ideas**, not real offers or required spending.
- The visualization contains synthetic agents, not GPS tracks.

## Notes
The client and server must share the same origin. A bare `index.html` opened with `file://` cannot synchronize with a backend. Use the Node server.

Data persistence is a single JSON file suitable for a prototype only. Concurrent multi-instance deployment requires a real database and server-side transactional writes. The historical data is not immutable; server administrators can modify it.
