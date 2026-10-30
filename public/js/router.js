// Minimal History API router plumbing. app.js registers the handler.
let handler = null;

export const setRouteHandler = (fn) => {
  handler = fn;
};

export function navigate(to, { replace = false } = {}) {
  let url;
  try {
    url = new URL(to, location.origin);
  } catch (e) {
    return;
  }
  if (url.origin !== location.origin) {
    location.href = url.href;
    return;
  }
  const path = url.pathname + url.search + url.hash;
  if (path !== location.pathname + location.search + location.hash) {
    history[replace ? 'replaceState' : 'pushState']({}, '', path);
  }
  if (handler) handler({ push: true });
}

// change the query string without re-rendering (used by shop filters)
export function replaceQuery(params) {
  const u = new URL(location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v === '' || v == null || v === false || v === 0) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
  });
  history.replaceState(history.state, '', u.pathname + u.search);
}

export const query = () => Object.fromEntries(new URLSearchParams(location.search));
