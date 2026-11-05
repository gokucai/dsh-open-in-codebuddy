/**
 * Wire vocabulary shared by both halves of the plugin. The browser bundle cannot
 * import Host modules, so `client.js` carries its own copy of these strings —
 * keep both in sync.
 */

/** Reports whether this Host can launch CodeBuddy, so the menu row appears only when it can work. */
export const STATUS_PATH = '/open-in-codebuddy/status'

/** Launches CodeBuddy on one absolute workspace directory. */
export const OPEN_PATH = '/open-in-codebuddy/open'

/** The id CodeBuddy occupies in the application menu. */
export const CODEBUDDY_ID = 'codebuddy'

/** The product name shown in the menu; a product name is not localized copy. */
export const CODEBUDDY_NAME = 'CodeBuddy'
