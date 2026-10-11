# Employee Manager

Offline employee management desktop app built with Electron, React, and Prisma (SQLite).
All data is stored locally — no server or internet connection required.

## Features

- Employee records: name, position, department, phone, joined date, salary
- Create, edit, and delete employees
- Search (debounced) and department filter, with pagination (10/25/50 per page)
- Import / export employees as CSV (Papa Parse) or JSON; CSV imports report every
  invalid row in a dialog (all-or-nothing — nothing is written on validation errors)
- App lock with PIN (salted hash stored locally, never plaintext)
- Light / dark theme (next-themes), toast notifications (Sonner)
- Cross-platform packaging: Windows (NSIS), macOS (DMG), Linux (AppImage / deb)

## Tech Stack

| Layer      | Technology                                             |
| ---------- | ------------------------------------------------------ |
| Shell      | Electron 39, electron-vite 5, electron-builder 26      |
| Renderer   | React 19, TypeScript, Tailwind CSS 4, Radix UI, shadcn-style components, react-hook-form + Zod |
| Main       | TypeScript, Prisma 6 (SQLite), Papa Parse              |

## Prerequisites

- Node.js (LTS recommended)
- npm

## Getting Started

```bash
# install dependencies (also generates the Prisma client)
npm install

# start in development with hot reload
npm run dev
```

The SQLite database (`employee.db`) is copied to the OS user-data directory on first run
(e.g. `%APPDATA%\Employee Manager` on Windows). `DATABASE_URL` is resolved at runtime —
no `.env` setup is needed for the packaged app. Development defaults live in `.env`:

```
DATABASE_URL="file:./employee.db"
```

## Available Scripts

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start in development mode with hot reload          |
| `npm start`         | Preview the production build                       |
| `npm run build`     | Typecheck and build for production                 |
| `npm run build:win` | Build a Windows installer (NSIS)                   |
| `npm run build:mac` | Build a macOS DMG                                  |
| `npm run build:linux` | Build Linux AppImage and deb packages            |
| `npm run build:unpack` | Build unpacked (portable) output for testing    |
| `npm run typecheck` | Typecheck main (`tsconfig.node.json`) and renderer (`tsconfig.web.json`) |
| `npm run lint`      | Run ESLint                                         |
| `npm run format`    | Format the codebase with Prettier                  |
| `npm test`          | Run unit tests (Vitest)                            |

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # App entry, window creation
│   ├── ipc.ts      # IPC handlers (CRUD, import/export, lock, PIN)
│   ├── db.ts       # Prisma client init, DB copy-on-first-run
│   ├── csv.ts      # CSV import/export helpers
│   ├── password.ts # PIN hashing (salted)
│   └── generated/  # Generated Prisma client (committed, copied to out/ at build)
├── preload/        # Context-isolated bridge (window.api)
├── renderer/       # React UI
│   └── src/
│       ├── components/   # EmployeeTable, dialogs, ui/ primitives
│       ├── hooks/        # useEmployeeStore
│       └── App.tsx
└── shared/         # Types shared between main and renderer (e.g. Employee)

prisma/             # schema.prisma, migrations, seed employee.db
```

## Data Model

```prisma
model Employee {
  id         Int      @id @default(autoincrement())
  name       String
  position   String
  department String
  phone      String?
  joinedDate String
  salary     Float
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model AppSetting {
  id           Int     @id @default(autoincrement())
  isLocked     Boolean @default(false)
  passwordHash String
  passwordSalt String
}
```

After changing `prisma/schema.prisma`, regenerate the client:

```bash
npx prisma generate        # outputs to src/main/generated/prisma
```

The custom `with-local-prisma-client` plugin in `electron.vite.config.ts` externalizes
imports of `generated/prisma` and copies the client (schema, engines, runtime) into
`out/main/generated/prisma` after each build.

## Packaging Notes

- Native `.node` modules and `resources/` are unpacked from the asar archive.
- `prisma/employee.db` ships as an extra resource and is copied to user data on first launch.
- Installer artifacts land in `dist/` (e.g. `employee-manager-1.0.0-setup.exe`).
```