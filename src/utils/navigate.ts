export const navigate = (path: string, options: { replace?: boolean } = {}) => {
  if (typeof window === "undefined") return;

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath === path) return;

  if (options.replace) {
    window.history.replaceState({}, "", path);
  } else {
    window.history.pushState({}, "", path);
  }

  window.dispatchEvent(new PopStateEvent("popstate"));
  window.dispatchEvent(new Event("hallschat:navigation-start"));
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};
