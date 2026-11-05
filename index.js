/**
 * Host half of the "Open In... CodeBuddy" bundle.
 *
 * Opening a workspace is a Host operation: only this process may locate the
 * CodeBuddy application and spawn it. The two routes below are the whole Host
 * surface — report whether CodeBuddy is installed, then launch it. Both sit
 * behind the composition's `connection` trust fence, so an unauthenticated or
 * cross-origin caller neither learns anything nor launches anything.
 *
 * Why a separate package rather than a shipped catalog entry: DSH's
 * `@deepseek-ai/dsh-host-open-in-app` resolves its catalogue from a
 * compile-time table with no configuration seam, so a third party cannot add
 * an application to it. This package therefore ships the detection and launch
 * for one extra application, and its Client half owns the menu that lists
 * CodeBuddy beside the shipped ones.
 */

import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { OPEN_PATH, STATUS_PATH } from './shared.js'

/** Cordis function-plugin name. */
export const name = 'open-in-codebuddy'

/** The route carrier, the trust fence guarding both routes, and PATH resolution. */
export const inject = ['webServer', 'connection', 'subprocess']

/** Open-route request bodies are tiny JSON objects; anything larger is hostile. */
const MAX_BODY_BYTES = 64 * 1024

/** The macOS bundle id, so a truthful install is told apart from a look-alike. */
const DARWIN_BUNDLE_ID = 'com.tencent.codebuddycn'

/** Bundle display names the macOS install may use. */
const DARWIN_APP_NAMES = ['CodeBuddy CN.app', 'CodeBuddy.app']

/** CLI names the product installs on PATH (Windows and Linux). */
const CLI_NAMES = ['codebuddy', 'cbc', 'codebuddy-code']

/**
 * An explicit application path for a non-standard install. An unset variable
 * expands to an empty string, which is treated as "not configured" so a stray
 * empty export cannot shadow detection.
 * @returns {string | undefined} the configured path, when one is set.
 */
function configuredAppPath() {
  const configured = process.env.CODEBUDDY_APP_PATH
  return configured === undefined || configured === '' ? undefined : configured
}

/**
 * Resolve the macOS application bundle: the configured path first, then the two
 * standard application directories under the names the product installs.
 * @returns {Promise<string | undefined>} the bundle path, when one exists.
 */
async function darwinBundlePath() {
  const candidates = [
    configuredAppPath(),
    ...DARWIN_APP_NAMES.map((appName) => join('/Applications', appName)),
    ...DARWIN_APP_NAMES.map((appName) => join(homedir(), 'Applications', appName)),
  ].filter((candidate) => candidate !== undefined)
  for (const candidate of candidates) {
    try {
      await stat(join(candidate, 'Contents', 'Info.plist'))
      return candidate
    } catch {
      // not installed at this location; try the next one
    }
  }
  return undefined
}

/**
 * Read the bundle identifier so a renamed but genuine install still opens while
 * an unrelated application that happens to share the path does not.
 * @param {string} appPath - the application bundle.
 * @returns {Promise<string | undefined>} the declared bundle id.
 */
async function darwinBundleIdentifier(appPath) {
  try {
    const plist = await readFile(join(appPath, 'Contents', 'Info.plist'), 'utf8')
    return /<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1]?.trim()
  } catch {
    return undefined
  }
}

/**
 * Find a launchable CodeBuddy on this Host.
 *
 * On macOS the IDE's own CLI opens a folder as a workspace in a NEW window,
 * which is the behavior users expect; `open -a` is the fallback for builds that
 * ship without that CLI. Elsewhere the product's PATH CLI is used with the
 * directory as its working directory.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - for PATH resolution.
 * @returns {Promise<{ available: true, argv: string[] } | { available: false, reason: string }>}
 *   the launcher prefix (the workspace path is appended by the caller) or a reason.
 */
async function resolveLauncher(ctx) {
  if (process.platform === 'darwin') {
    const appPath = await darwinBundlePath()
    if (appPath === undefined) {
      return { available: false, reason: 'CodeBuddy is not installed in /Applications' }
    }
    const bundleId = await darwinBundleIdentifier(appPath)
    if (bundleId !== undefined && bundleId !== DARWIN_BUNDLE_ID) {
      return { available: false, reason: `${appPath} is not CodeBuddy (bundle id ${bundleId})` }
    }
    const cli = join(appPath, 'Contents', 'Resources', 'app', 'bin', 'code')
    try {
      await stat(cli)
      return { available: true, argv: [cli, '-n'] }
    } catch {
      return { available: true, argv: ['/usr/bin/open', '-a', appPath] }
    }
  }
  for (const cliName of CLI_NAMES) {
    try {
      const executable = await ctx.subprocess.resolveExecutable(cliName)
      return { available: true, argv: [executable] }
    } catch {
      // try the next name
    }
  }
  return {
    available: false,
    reason: `no CodeBuddy launcher found (tried ${CLI_NAMES.join(', ')})`,
  }
}

/**
 * Launch detached and stdio-free so the application outlives this Host process.
 * @param {readonly string[]} argv - executable plus arguments (never a shell string).
 * @param {string} cwd - the workspace directory the launcher runs in.
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>} the spawn outcome.
 */
function spawnDetached(argv, cwd) {
  return new Promise((resolve) => {
    let settled = false
    const settle = (outcome) => {
      if (settled) return
      settled = true
      resolve(outcome)
    }
    let child
    try {
      child = spawn(argv[0], argv.slice(1), { cwd, detached: true, stdio: 'ignore' })
    } catch (error) {
      settle({ ok: false, message: error instanceof Error ? error.message : String(error) })
      return
    }
    child.once('error', (error) => settle({ ok: false, message: error.message }))
    child.once('spawn', () => {
      // The IDE keeps its window open for the whole session; it must not hold
      // this process's event loop.
      child.unref()
      settle({ ok: true })
    })
  })
}

/** @param {import('node:http').ServerResponse} res */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/**
 * Collect a bounded request body as UTF-8 text.
 * @returns {Promise<string | null>} the body, or null past the ceiling.
 */
async function readBoundedBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      req.resume()
      return null
    }
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  /** One resolution per Host process; an install change needs a restart. */
  let resolution

  const launcherOf = () => {
    resolution ??= resolveLauncher(ctx)
    return resolution
  }

  /**
   * Answer an untrusted or unauthenticated request.
   * @returns {boolean} true when the request was rejected.
   */
  const rejected = (req, res) => {
    const connection = Reflect.get(ctx, 'connection')
    const rejection = connection.requestRejection(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: STATUS_PATH,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'GET') {
        res.statusCode = 405
        res.setHeader('allow', 'GET')
        res.end()
        return
      }
      const state = await launcherOf()
      sendJson(res, 200, state.available
        ? { available: true }
        : { available: false, reason: state.reason })
    },
  }), `open-in-codebuddy: GET ${STATUS_PATH}`)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: OPEN_PATH,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'POST')
        res.end()
        return
      }
      if (String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
        sendJson(res, 415, { ok: false, message: 'content-type must be application/json' })
        return
      }
      const text = await readBoundedBody(req)
      if (text === null) {
        sendJson(res, 413, { ok: false, message: 'request body is too large' })
        return
      }
      let path
      try {
        const body = JSON.parse(text)
        path = typeof body?.path === 'string' ? body.path : undefined
      } catch {
        path = undefined
      }
      if (path === undefined || path === '' || !isAbsolute(path)) {
        sendJson(res, 400, { ok: false, message: 'path must be an absolute directory path' })
        return
      }
      let isDirectory = false
      try {
        isDirectory = (await stat(path)).isDirectory()
      } catch {
        isDirectory = false
      }
      if (!isDirectory) {
        sendJson(res, 404, { ok: false, message: `directory does not exist: ${path}` })
        return
      }

      const state = await launcherOf()
      if (!state.available) {
        sendJson(res, 503, { ok: false, message: state.reason })
        return
      }
      const outcome = await spawnDetached([...state.argv, path], path)
      if (!outcome.ok) {
        sendJson(res, 502, { ok: false, message: outcome.message })
        return
      }
      sendJson(res, 200, { ok: true, path })
    },
  }), `open-in-codebuddy: POST ${OPEN_PATH}`)
}
