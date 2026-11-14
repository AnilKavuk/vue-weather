# Next Weather

Next.js App Router + React + TypeScript weather application using the [OpenWeather API](https://openweathermap.org/api). The Turkish interface, Celsius temperatures, and warm/cold backgrounds are preserved from the Vue application.

## Setup

Use Node.js 22.12 or newer.

TypeScript and the React/Node type packages are regular dependencies because `next build` needs them even when dependencies are installed with `NODE_ENV=production` or `--omit=dev`. Install development dependencies with `npm install --include=dev` to run linting and image optimization.

1. Copy `.env.example` to `.env.local` and add your OpenWeather API key:

```env
OPENWEATHER_API_KEY=your_openweather_key
```

The Next.js backend reads this variable at request time. Keep it in `.env.local` for development and configure it as a server environment variable on your deployment platform. Restart the server after changing the key. A key is not required to build or run the mocked tests.

2. Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

## Weather requests

The browser sends only the city to the same-origin Next.js endpoint:

```http
POST /api/weather
Content-Type: application/json

{"city":"İstanbul"}
```

The server calls OpenWeather over HTTPS with the private key, metric units, and Turkish descriptions. A successful response contains only the fields displayed in the UI:

```json
{"name":"İstanbul","country":"TR","temperature":18.4,"description":"açık"}
```

Errors return `{"message":"..."}` with status 400 for invalid input, 404 for an unknown city, 429 for the provider's quota limit, 503 for a missing server key, or 502 for provider/network failures. Upstream requests time out after 10 seconds. Responses are not cached, and raw provider error bodies are never forwarded.

The API key stays in the server route. Do not give it a `NEXT_PUBLIC_` prefix or put it in `next.config.js` under `env`: those approaches expose values to the browser. The previous `VITE_OPENWEATHER_API_KEY` variable is no longer used. Use your existing OpenWeather account to obtain the key; Next.js does not issue an OpenWeather token. Rotate any key previously exposed in a browser bundle.

## Commands

```sh
npm run build          # Build for production
npm start              # Serve the production build
npm run typecheck      # Check TypeScript
npm run lint           # Check Next.js, React, and TypeScript rules
npm test               # Test the POST handler with mocked OpenWeather responses
npm run optimize:images
```

Deploy to a host that supports the Next.js server or run `npm run build` followed by `npm start` on Node.js. The POST backend requires a running server; a static export cannot handle weather requests. `PORT` can be configured in the server environment.

The tests use Node's built-in TypeScript stripping and the `react-server` condition for the `server-only` import. They require no real key or network access. They cover input validation, runtime credentials, query encoding, response filtering, upstream status codes, malformed responses, and network/timeout failures.

Background images are in `public/images`. `npm run optimize:images` refreshes the AVIF versions and optimizes large JPEGs.

![cold-weather](https://user-images.githubusercontent.com/36512716/175110837-003c4a7b-4713-4b67-9358-ecee9a087278.png)
![warm-weather](https://user-images.githubusercontent.com/36512716/175110849-72277c69-02a2-4541-8735-77ebd4dad61e.png)
