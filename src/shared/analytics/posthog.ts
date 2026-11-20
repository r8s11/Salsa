import type { PostHog } from "posthog-js";

type Call = (client: PostHog) => void;

// posthog-js loads after first render (see main.tsx) so it stays out of the
// entry chunk. Calls made earlier wait here; with analytics unconfigured the
// queue is dropped once and later calls are no-ops.
const MAX_PENDING = 50;
let client: PostHog | null = null;
let pending: Call[] | null = [];

function run(call: Call) {
  if (client) call(client);
  else if (pending && pending.length < MAX_PENDING) pending.push(call);
}

export function startPostHog(init: (client: PostHog) => void) {
  void import("posthog-js").then(({ default: loaded }) => {
    init(loaded);
    client = loaded;
    pending?.forEach((call) => call(loaded));
    pending = null;
  }).catch(() => {
    pending = null;
  });
}

export function disablePostHog() {
  pending = null;
}

export const posthog = {
  capture: (...args: Parameters<PostHog["capture"]>) => run((c) => { c.capture(...args); }),
  identify: (...args: Parameters<PostHog["identify"]>) => run((c) => c.identify(...args)),
  reset: (...args: Parameters<PostHog["reset"]>) => run((c) => c.reset(...args)),
  register: (...args: Parameters<PostHog["register"]>) => run((c) => c.register(...args)),
  logger: {
    info: (...args: Parameters<PostHog["logger"]["info"]>) => run((c) => c.logger.info(...args)),
    warn: (...args: Parameters<PostHog["logger"]["warn"]>) => run((c) => c.logger.warn(...args)),
  },
};
