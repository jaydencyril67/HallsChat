export const navigate = (path: string, options: { replace?: boolean } = {}) => {
  if (typeof window === "undefined") return;

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath === path) return;

  const openingPublicProfile = /^\/users\/[^/]+$/.test(path.split(/[?#]/)[0]);
  const alreadyOnPublicProfile = /^\/users\/[^/]+$/.test(window.location.pathname);
  const existingBackground = window.history.state?.hallschatProfileModal ? window.history.state.backgroundPath : null;
  const nextState = openingPublicProfile
    ? { hallschatProfileModal: true, backgroundPath: alreadyOnPublicProfile && existingBackground ? existingBackground : currentPath }
    : {};

  if (options.replace) {
    window.history.replaceState(nextState, "", path);
  } else {
    window.history.pushState(nextState, "", path);
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
  window.dispatchEvent(new Event("hallschat:navigation-start"));
  // Opening a profile overlays the current screen; preserve its exact scroll position.
  if (!openingPublicProfile) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};
