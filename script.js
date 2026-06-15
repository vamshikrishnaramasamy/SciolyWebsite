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
    const prev = document.getElementById("ePrev");
    const next = document.getElementById("eNext");
    const cards = Array.from(hscroll.querySelectorAll(".ecard"));
    const reduceMotion = reduce;
    let drag = null;
    let suppressClick = false;

    const maxScroll = () => Math.max(hscroll.scrollWidth - hscroll.clientWidth, 0);
    const gap = () => parseFloat(getComputedStyle(hscroll.querySelector(".hscroll__track")).gap) || 16;
    const step = () => {
      const card = cards[0];
      return card ? card.offsetWidth + gap() : 320;
    };
    const cardPositions = () => cards.map((_, i) => i * step());
    const nearestCardIndex = () => {
      const positions = cardPositions();
      let best = 0;
      let bestDistance = Infinity;
      positions.forEach((left, i) => {
        const distance = Math.abs(hscroll.scrollLeft - left);
        if (distance < bestDistance) {
          best = i;
          bestDistance = distance;
        }
      });
      return best;
    };
    const nearestSnap = () => {
      const positions = cardPositions();
      return Math.min(positions[nearestCardIndex()] || 0, maxScroll());
    };
    const updateArrows = () => {
      const max = maxScroll() - 1;
      if (prev) prev.disabled = hscroll.scrollLeft <= 1;
      if (next) next.disabled = hscroll.scrollLeft >= max;
    };
    const setActiveCard = () => {
      const active = nearestCardIndex();
      cards.forEach((card, i) => card.classList.toggle("is-active", i === active));
    };
    const scrollToX = (left) => {
      hscroll.scrollTo({ left: Math.max(0, Math.min(left, maxScroll())), behavior: reduceMotion ? "auto" : "smooth" });
    };
    const release = () => {
      if (!drag) return;
      const moved = drag.moved;
      suppressClick = moved;
      try { hscroll.releasePointerCapture(drag.pointerId); } catch (_) {}
      drag = null;
      hscroll.classList.remove("grabbing");
      hscroll.style.scrollSnapType = "";

      if (!moved) return;
      scrollToX(nearestSnap());
    };

    hscroll.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      drag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startLeft: hscroll.scrollLeft,
        moved: false
      };
      hscroll.classList.add("grabbing");
      hscroll.style.scrollSnapType = "none";
      try { hscroll.setPointerCapture(e.pointerId); } catch (_) {}
    });

    hscroll.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX;

      if (Math.abs(dx) > 5) drag.moved = true;
      if (!drag.moved) return;
      e.preventDefault();
      hscroll.scrollLeft = drag.startLeft - dx;
    });

    hscroll.addEventListener("pointerup", release);
    hscroll.addEventListener("pointercancel", release);

    hscroll.addEventListener("click", (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    }, true);

    if (prev) prev.addEventListener("click", () => scrollToX(hscroll.scrollLeft - step() * 2));
    if (next) next.addEventListener("click", () => scrollToX(hscroll.scrollLeft + step() * 2));
    hscroll.addEventListener("scroll", () => {
      updateArrows();
      setActiveCard();
    }, { passive: true });
    window.addEventListener("resize", () => {
      updateArrows();
      setActiveCard();
    });
    updateArrows();
    setActiveCard();
  }

  /* ---- footer year ---- */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  if (hasGSAP) window.addEventListener("load", () => ScrollTrigger.refresh());
})();
