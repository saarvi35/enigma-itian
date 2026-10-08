# ENIGMA — Decode the Unknown

A responsive sample experience for the ITian Club, GNDEC mystery-solving event.

## Run locally

Requires Node.js 18 or later. From this folder:

```sh
npm run dev
```

Open `http://127.0.0.1:4173`. The participant page has no organizer-console button or link. Open `http://127.0.0.1:4173/organizer` and enter the organizer PIN printed in the server terminal. Start the event there; teams can register before or during the live event, then start their own 45-minute case clock. You can set a stable PIN with the `ORGANIZER_PIN` environment variable before starting the server.

## Case content

Puzzle sets and suspect records live in `content.js`, separate from the interface and progression code in `app.js`. The four variants share the same case structure and answer progression. Replace the content object to author another case while retaining the UI.

## Storage boundary

Locally, team records and event state are stored in `.enigma-data/`. When `DATABASE_URL` is set, the server uses PostgreSQL for shared team records and event state. The `render.yaml` Blueprint configures a Free web service and Free Postgres database in Singapore. Render Free web services sleep after 15 minutes without requests, and the next request can take about a minute to wake; Free Postgres is limited to 1 GB and expires after 30 days. The client still calculates the case timer and validates answers, so use this setup for testing rather than a high-stakes competition.

## Deploy on Render Free

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Enter a private 8-digit value when prompted for `ORGANIZER_PIN`.
4. Apply the Blueprint. It creates the free web service and PostgreSQL database and connects them with `DATABASE_URL`.
5. Share the generated `onrender.com` URL with participants. Open `/organizer` on the same domain to manage the event.

Free Render is suitable for testing, with two limits: the web service sleeps after 15 minutes idle (first wake can take about one minute), and the free PostgreSQL database expires after 30 days. Back up/export results before the database expires.
