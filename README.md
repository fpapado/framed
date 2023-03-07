# Framed

> Pictures in frames, quickly and locally in your browser.

## Prerequisites

You will need [node](https://nodejs.org/en/) and [pnpm](https://pnpm.io/installation#using-corepack).

We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage your node version.

Start by installing nvm, then in a terminal, such as iTerm, Gnome Terminal, or Windows Subsystem for Linux, type:

```shell
nvm use
```

This should install the correct version of node for your system.

Then, follow the instructions for [installing pnpm, preferably using corepack](https://pnpm.io/installation#using-corepack).

## Install dependencies

Assuming that you have set up node, pnpm and nvm, in a terminal run:

```shell
pnpm i
```

You should be ready to go!

## Available Scripts

In the project directory, you can run:

### `pnpm start`

Runs the app in the development mode.\
Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `pnpm test`

Launches the test runner, specifically [Playwright](playwright.dev/).
Playwright is used for end-to-end testing, using the real browser environment.

### `pnpm run build`

Builds the app for production to the `dist` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.
The build is minified and the filenames include the hashes.

### `pnpm run preview`

Builds the app for production (similar to `pnpm run build`), and launches a local server that serves the app in production mode.

`pnpm run preview` is useful for benchmarking performance issues, since all optimisations are applied.

### `pnpm run lint`

Runs ESLint, surfacing errors and warnings in the project.

## Deployment

The production app is on [Netlify](netlify.com/).
You can deploy the app anywhere that serves static files, i.e. those under the `dist` directory.
