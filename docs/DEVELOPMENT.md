# Development

## Prerequisites

- Node.js 18+
- npm 9+
- Git

## Setup

```bash
git clone https://github.com/coding-crying/WikiPrepared.git
cd WikiPrepared
npm install
```

## Run (dev)

```bash
npm run dev
```

## Build (distributables)

On Linux, this produces an AppImage and a `.deb`:

```bash
npm run dist
```

Cross-platform packaging generally needs to be run on the target OS:

```bash
npm run dist:win
npm run dist:mac
```

## Tests / lint

```bash
npm test
npm run lint
```

