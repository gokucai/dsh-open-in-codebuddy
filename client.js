window.__ModuleLoader__.load({
  id: 'dsh-open-in-codebuddy',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'open-in-codebuddy'

    /** This plugin's own Host routes. */
    const STATUS_ROUTE = '/open-in-codebuddy/status'
    const OPEN_ROUTE = '/open-in-codebuddy/open'

    /** English copy; every key has a Chinese counterpart below. */
    const en = {
      'action.label': 'Open in CodeBuddy',
      'action.busy': 'Opening in CodeBuddy…',
      'action.failed': 'Could not open the workspace in CodeBuddy',
    }

    /** Simplified Chinese copy. */
    const zh = {
      'action.label': '用 CodeBuddy 打开',
      'action.busy': '正在用 CodeBuddy 打开…',
      'action.failed': '无法用 CodeBuddy 打开该工作区',
    }

    /**
     * Geometry copied from DSH's shipped `OpenTargetButton` stylesheet so this
     * control sits beside the native ones without a visual seam. Only `--dsw-*`
     * theme tokens carry over; the class names are local.
     */
    const CSS = `
.iocb-root{position:relative;display:inline-flex;flex:none;align-self:center}
.iocb-split{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);
  border-radius:var(--dsw-radius-sm);height:24px;font-family:var(--dsw-font-family);
  align-items:stretch;display:inline-flex;overflow:hidden}
.iocb-main{color:var(--dsw-alias-label-primary);white-space:nowrap;cursor:pointer;
  background:0 0;border:0;justify-content:center;align-items:center;font-size:11px;
  line-height:16px;display:inline-flex;gap:4px;padding:3px 6px}
.iocb-main:hover:not(:disabled),.iocb-main:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.iocb-main:disabled{cursor:default;color:var(--dsw-alias-label-secondary)}
.iocb-main svg{width:13px;height:13px;flex:none}
.iocb-toast{position:absolute;top:calc(100% + 6px);right:0;z-index:21;max-width:240px;
  padding:4px 8px;border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-overlay);
  color:var(--dsw-alias-state-error-primary);font-family:var(--dsw-font-family);
  font-size:11px;line-height:16px}
`

    /**
     * Whether this Host can launch CodeBuddy. One read per page: the answer
     * decides whether the control exists, and an install change needs a Host
     * restart to show up.
     * @returns {Promise<boolean>} true when a launcher is available.
     */
    let availability
    function loadAvailability() {
      availability ??= fetch(STATUS_ROUTE, { headers: { accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : { available: false }))
        .then((payload) => payload?.available === true)
        .catch(() => false)
      return availability
    }

    /**
     * Ask the Host to launch CodeBuddy on the workspace directory.
     * @returns {Promise<string | undefined>} the failure message, or undefined on success.
     */
    async function openWorkspace(path) {
      let response
      try {
        response = await fetch(OPEN_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path }),
        })
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
      if (response.ok) return undefined
      try {
        const payload = await response.json()
        if (typeof payload?.message === 'string') return payload.message
      } catch {
        // the Host answered without a JSON body; the status is all there is
      }
      return `HTTP ${response.status}`
    }

    /** The CodeBuddy mark: a code glyph, matching the native icon scale. */
    function Glyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      }, [
        h('path', { key: 'a', d: 'M5.6 4.2 1.8 8l3.8 3.8' }),
        h('path', { key: 'b', d: 'M10.4 4.2 14.2 8l-3.8 3.8' }),
        h('path', { key: 'c', d: 'M9.2 2.6 6.8 13.4' }),
      ])
    }

    /**
     * The Session-header CodeBuddy opener: one button that hands the Session's
     * workspace directory to CodeBuddy.
     *
     * The cell id is this plugin's own (`open-in-codebuddy`), so the control
     * renders beside DSH's shipped "Open In..." control without touching it.
     * That matters because the slot core rejects a duplicate cell id at the same
     * priority and only shadows at a lower one — reusing the shipped id would
     * mean replacing the native control outright.
     *
     * @param props - standard Session header props plus the localized `t`.
     */
    function CodeBuddyHeaderButton(props) {
      const { t, sessionId, useSessions } = props
      const cwd = useSessions((state) => state.byId[sessionId]?.cwd)
      const [available, setAvailable] = React.useState(false)
      const [pending, setPending] = React.useState(false)
      const [failure, setFailure] = React.useState(undefined)

      React.useEffect(() => {
        let live = true
        loadAvailability().then((next) => {
          if (live) setAvailable(next)
        })
        return () => {
          live = false
        }
      }, [])

      React.useEffect(() => {
        if (failure === undefined) return undefined
        const timer = setTimeout(() => setFailure(undefined), 6000)
        return () => clearTimeout(timer)
      }, [failure])

      if (!available || cwd === undefined || cwd === '') return null

      const label = pending ? t('action.busy') : t('action.label')
      return h('span', { className: 'iocb-root' }, [
        h('style', { key: 'style' }, CSS),
        h('span', {
          key: 'split',
          className: 'iocb-split',
          'data-open-target': 'directory',
          'data-size': 'compact',
          'data-state': pending ? 'busy' : 'idle',
        }, h('button', {
          key: 'main',
          type: 'button',
          className: 'iocb-main',
          title: cwd,
          disabled: pending,
          'aria-label': label,
          'aria-busy': pending,
          'data-codebuddy-opener': '',
          onClick: async () => {
            if (pending) return
            setPending(true)
            setFailure(undefined)
            const message = await openWorkspace(cwd)
            setPending(false)
            if (message !== undefined) {
              setFailure(`${t('action.failed')}: ${message}`)
            }
          },
        }, [h(Glyph, { key: 'glyph' }), h('span', { key: 'text' }, 'CodeBuddy')])),
        failure === undefined
          ? null
          : h('span', { key: 'toast', className: 'iocb-toast', role: 'status', title: failure }, failure),
      ])
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'open-in-codebuddy: dictionaries')
        ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          // This plugin's own cell id: a fresh id renders beside the shipped
          // entries, while reusing the shipped `open-in-app` id would collide
          // with it (same priority) or replace it (lower priority).
          id: 'open-in-codebuddy',
          order: -9,
          locale: NS,
        }, CodeBuddyHeaderButton)), 'open-in-codebuddy: header button')
      },
    }
  },
})
