# Vue Weather

Weather project made using the [OpenWeather API](https://openweathermap.org/api) with Vue.js and Vite.

## Setup

1. Copy `.env.example` to `.env.local` and add your OpenWeather API key:

```env
VITE_OPENWEATHER_API_KEY=your_openweather_key
```

Vite reads this variable during development and replaces it in the application bundle during `npm run build`. Restart the development server after changing it; rebuild the application when changing it in a deployed environment.

2. Install dependencies:

```sh
npm install
```

## Scripts

Start the development server:

```sh
npm run dev
```

The application is available at `http://localhost:3000` and sends weather requests directly to OpenWeather.

Other commands:

```sh
npm run build
npm start
npm run optimize:images
npm run lint
npm test
```

`npm start` serves the built application. Run `npm run build` first.

## API Key Notes

- `VITE_OPENWEATHER_API_KEY` is a build-time setting; it does not need to exist on the server that serves `dist`
- Every `VITE_*` value is included in the browser bundle and can be inspected by users
- Never commit a real API key to version control; use `.env.local` for local development
- Configure the variable in your deployment platform before running `npm run build`
- If a previously private key was committed or otherwise leaked, rotate it in OpenWeather

![cold-weather](https://user-images.githubusercontent.com/36512716/175110837-003c4a7b-4713-4b67-9358-ecee9a087278.png)
![warm-weather](https://user-images.githubusercontent.com/36512716/175110849-72277c69-02a2-4541-8735-77ebd4dad61e.png)
