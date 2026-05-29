(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) return;

  function showUpdateToast() {
    var toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;" +
      "background:#171c20;color:#7bd0ff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;" +
      "box-shadow:0 4px 24px rgba(0,0,0,0.5);cursor:pointer;white-space:nowrap;";
    toast.textContent = "\u26a1 \u65b0\u7248\u672c\u53ef\u7528\uff0c\u70b9\u51fb\u5237\u65b0";
    toast.onclick = function () { window.location.reload(); };
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 15000);
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", function () {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        }
      });
    }, function (err) {
      console.warn("SW registration failed:", err);
    });
  });
})();
