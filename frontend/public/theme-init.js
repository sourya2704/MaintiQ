// Runs before the app loads: apply the saved theme so dark mode never flashes white.
(function () {
  try {
    var t = localStorage.getItem("mantiq-theme");
    var dark = t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", dark ? "#090c10" : "#1c232b");
  } catch (e) {}
})();
