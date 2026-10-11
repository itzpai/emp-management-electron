import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

// Tool terminals (e.g. spawned by VS Code extensions) can export
// ELECTRON_RUN_AS_NODE=1. electron-vite spawns the Electron binary with the
// inherited environment, which then starts as plain Node.js: no `app` module
// (crash on `electron.app.isPackaged`), no BrowserWindow and no preload
// scripts, so the renderer has no `window.api`. Strip it so dev/preview
// always launch a real Electron app.
delete process.env.ELECTRON_RUN_AS_NODE

const GENERATED_PRISMA_PATTERN = /(^|[/\\])generated[/\\]prisma$/

function withLocalPrismaClient(): Plugin {
  return {
    name: 'with-local-prisma-client',
    enforce: 'pre',
    resolveId(source) {
      if (GENERATED_PRISMA_PATTERN.test(source)) {
        return { id: source, external: true }
      }
      return null
    },
    closeBundle() {
      const src = resolve('src/main/generated/prisma')
      const dest = resolve('out/main/generated/prisma')
      fs.rmSync(dest, { recursive: true, force: true })
      fs.mkdirSync(dest, { recursive: true })
      for (const file of ['index.js', 'package.json', 'schema.prisma']) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file))
      }
      for (const engine of fs.readdirSync(src).filter((f) => f.endsWith('.node'))) {
        fs.copyFileSync(path.join(src, engine), path.join(dest, engine))
      }
      fs.cpSync(path.join(src, 'runtime'), path.join(dest, 'runtime'), { recursive: true })
      const runtimeDest = path.join(dest, 'runtime')
      for (const name of fs.readdirSync(runtimeDest).filter((f) => f.endsWith('.js'))) {
        const file = path.join(runtimeDest, name)
        const code = fs.readFileSync(file, 'utf8')
        const stripped = code.replace(/\n?\/\/[#@] sourceMappingURL=\S+\s*$/, '')
        if (stripped !== code) {
          fs.writeFileSync(file, stripped)
        }
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), withLocalPrismaClient()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
