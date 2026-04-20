try {
  var d = document.documentElement;
  var t = localStorage.getItem("agimav.theme");
  if (t === "dark") d.classList.add("dark");
  var a = localStorage.getItem("agimav.accent");
  if (a === "amber" || a === "violet" || a === "sky") d.dataset.accent = a;
  var n = localStorage.getItem("agimav.density");
  if (n === "compact" || n === "comfortable") d.dataset.density = n;
} catch {}
