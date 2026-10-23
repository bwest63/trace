/* TRACE as an installed app: offline start-up (sw.js), the Install button,
 * and the "update ready" prompt. Independent of the rest of TRACE. */
(function () {
  const standalone =
    matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;
  const iOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost")
  ) {
    navigator.serviceWorker
      .register("sw.js")
      .catch((e) => console.warn("TRACE offline support unavailable", e));
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "trace-update") showUpdateBanner();
    });
  }

  function showUpdateBanner() {
    if (document.getElementById("traceUpdate")) return;
    const bar = document.createElement("div");
    bar.id = "traceUpdate";
    bar.className = "trace-update";
    bar.setAttribute("role", "status");
    bar.innerHTML =
      '<span>A TRACE update is ready.</span><button type="button" class="primary">Reload</button><button type="button" class="text-link" aria-label="Dismiss">Later</button>';
    const [reload, later] = bar.querySelectorAll("button");
    reload.onclick = () => location.reload();
    later.onclick = () => bar.remove();
    document.body.appendChild(bar);
  }

  // Install button: Chrome/Edge/Android offer a real prompt; iPhone and iPad need Share → Add to Home Screen.
  if (standalone) return;
  let installPrompt = null;
  const box = document.createElement("div");
  box.className = "trace-install";
  box.innerHTML =
    '<button type="button" id="traceInstall">⇩ Install TRACE app</button>';
  const footer = document.querySelector(".sidebar-footer");
  if (footer) footer.parentElement.insertBefore(box, footer);
  box.hidden = !iOS;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    box.hidden = false;
  });
  window.addEventListener("appinstalled", () => box.remove());
  box.querySelector("button").onclick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") box.remove();
      installPrompt = null;
      return;
    }
    alert(
      iOS
        ? "To install TRACE: tap the Share button (the square with an arrow) in Safari's toolbar, then choose “Add to Home Screen”."
        : "To install TRACE, use your browser's menu and choose “Install app” or “Add to Home screen”.",
    );
  };
})();
