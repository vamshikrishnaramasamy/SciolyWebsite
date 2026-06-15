/* Westview Science Olympiad — restrained, premium motion */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";
  if (hasGSAP && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---- Lenis smooth scroll ---- */
  let lenis = null;
  if (!reduce && typeof Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasGSAP) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  const scrollTo = (el) => lenis ? lenis.scrollTo(el, { duration: 1.1 }) : el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });

  /* ---- hero entrance ---- */
  requestAnimationFrame(() => document.body.classList.add("ready"));

  /* ---- nav state + mobile ---- */
  const nav = document.getElementById("nav");
  const progress = document.getElementById("progress");
  const onScroll = () => {
    const y = lenis ? lenis.scroll : window.scrollY;
    nav.dataset.state = y > 16 ? "scrolled" : "top";
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }
  };
  if (lenis) lenis.on("scroll", onScroll); else window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("mobileMenu");
  const closeMenu = () => { toggle.setAttribute("aria-expanded", "false"); menu.hidden = true; };
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    if (open) closeMenu(); else { toggle.setAttribute("aria-expanded", "true"); menu.hidden = false; }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  /* ---- anchor smooth scroll ---- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault(); closeMenu(); scrollTo(t);
    });
  });

  /* ---- reveals ---- */
  const reveals = document.querySelectorAll("[data-reveal]");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((en, i) => {
        if (en.isIntersecting) {
          en.target.style.transitionDelay = Math.min(i * 60, 240) + "ms";
          en.target.classList.add("in");
          obs.unobserve(en.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));
  }

  /* ---- counters ---- */
  const animateCount = (el) => {
    const end = parseFloat(el.dataset.count);
    const suf = el.dataset.suffix || "", pre = el.dataset.prefix || "";
    if (reduce || !hasGSAP) { el.textContent = pre + end + suf; return; }
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.6, ease: "power3.out",
      onUpdate: () => { el.textContent = pre + Math.round(o.v) + suf; } });
  };
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver((entries, obs) => {
      entries.forEach((en) => { if (en.isIntersecting) { animateCount(en.target); obs.unobserve(en.target); } });
    }, { threshold: 0.6 });
    document.querySelectorAll("[data-count]").forEach((el) => cio.observe(el));
  } else {
    document.querySelectorAll("[data-count]").forEach((el) => { el.textContent = (el.dataset.prefix || "") + el.dataset.count + (el.dataset.suffix || ""); });
  }

  /* ---- events: native horizontal scroll + drag + arrows ---- */
  const hscroll = document.getElementById("hscroll");
  if (hscroll) {
    // click-and-drag to scroll
    let down = false, startX = 0, startLeft = 0, moved = false;
    hscroll.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = hscroll.scrollLeft;
      hscroll.classList.add("grabbing");
      try { hscroll.setPointerCapture(e.pointerId); } catch (_) {}
    });
    hscroll.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      hscroll.scrollLeft = startLeft - dx;
    });
    const release = () => { down = false; hscroll.classList.remove("grabbing"); };
    hscroll.addEventListener("pointerup", release);
    hscroll.addEventListener("pointercancel", release);
    hscroll.addEventListener("pointerleave", release);
    // swallow the click that ends a drag (so it doesn't feel janky)
    hscroll.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

    // arrow buttons
    const prev = document.getElementById("ePrev");
    const next = document.getElementById("eNext");
    const step = () => {
      const card = hscroll.querySelector(".ecard");
      return card ? card.offsetWidth + 16 : 320;
    };
    const updateArrows = () => {
      const max = hscroll.scrollWidth - hscroll.clientWidth - 1;
      if (prev) prev.disabled = hscroll.scrollLeft <= 0;
      if (next) next.disabled = hscroll.scrollLeft >= max;
    };
    if (prev) prev.addEventListener("click", () => hscroll.scrollBy({ left: -step() * 1.5, behavior: "smooth" }));
    if (next) next.addEventListener("click", () => hscroll.scrollBy({ left: step() * 1.5, behavior: "smooth" }));
    hscroll.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    updateArrows();
  }

  /* ---- footer year ---- */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  if (hasGSAP) window.addEventListener("load", () => ScrollTrigger.refresh());
})();
