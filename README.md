# dsh-open-in-codebuddy

English | [中文](README.zh.md)

Adds a **CodeBuddy** button to the DSH Session header: one click opens the current Session's workspace folder in [CodeBuddy](https://www.codebuddy.cn).

## Install

```sh
dsh plugin --profile <your-profile> add github:gokucai/dsh-open-in-codebuddy
```

Or from npm (prebuilt, no build approval needed):

```sh
dsh plugin --profile <your-profile> add dsh-open-in-codebuddy
```

The package declares `dsh.bundle`, so DSH adopts it as a profile bundle layer on install — no hand-editing of `cordis.patch.yml` or `package.json`.

## What you get

A CodeBuddy button appears in the Session header, directly beside DSH's own "Open In..." control and sharing its geometry:

```
[ ⧉ | ▾ ]            ← DSH's own "Open In..."
[ </> CodeBuddy ]    ← this plugin
```

Clicking it opens CodeBuddy on the current Session's workspace folder. While launching, the button shows a busy state; on failure an error notice appears beside it and clears after six seconds. When CodeBuddy is not detected, the button is not rendered at all.

## Platform support

| Platform | How it launches |
|---|---|
| macOS | CodeBuddy's own `Contents/Resources/app/bin/code -n <dir>`, which opens the folder as a workspace in a new window; falls back to `open -a` when that CLI is absent |
| Windows / Linux | `codebuddy` / `cbc` / `codebuddy-code` from `PATH`, run with the folder as the working directory |

On macOS the bundle id must be `com.tencent.codebuddycn`, so a renamed install still works while an unrelated application at the same path is not launched.

### Non-standard install location

`/Applications` and `~/Applications` are searched for `CodeBuddy CN.app` and `CodeBuddy.app`. If yours lives elsewhere, set the variable and restart DSH:

```sh
export CODEBUDDY_APP_PATH="/path/to/CodeBuddy CN.app"
```

## How it works

- **Host half** (`index.js`) detects and launches CodeBuddy behind two routes: `GET /open-in-codebuddy/status` and `POST /open-in-codebuddy/open`. Both sit behind DSH's connection trust fence (`ctx.connection.requestRejection`), so unauthenticated and cross-origin callers are rejected before any detection or launch runs. Request bodies are capped at 64 KiB, must be `application/json`, and the path must be an existing absolute directory. Launches never go through a shell: arguments are passed as argv, detached, with no stdio pipes.
- **Client half** (`client.js`) registers under its own cell id `open-in-codebuddy` in `conversation.session.header.utilities`, so it sits beside DSH's native control without touching it.

DSH's shipped application catalogue (`@deepseek-ai/dsh-host-open-in-app`) is a compile-time table with no configuration seam, so a third party cannot append CodeBuddy to that native dropdown. In the slot system, a duplicate cell id at the same priority throws, and only a lower priority shadows the native control — which means taking over its UI wholesale. This plugin uses its own cell id instead: it works on install, reverts on uninstall, and leaves the native control untouched.

## Permissions

The Host half runs with the DSH process's own permissions: it reads application install locations and spawns one local process. It makes no network requests, reads no workspace files, and touches no credentials.

## Uninstall

```sh
dsh plugin --profile <your-profile> remove dsh-open-in-codebuddy
```

## License

MIT
