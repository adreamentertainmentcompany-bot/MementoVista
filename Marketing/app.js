/* Momento — momento.tv
   Progressive enhancement: typewriter, scroll reveal, header state,
   poster→video swap (only swaps when the demo MP4 exists), beta form. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------- Header scroll state ---------------- */
const header = $(".site-header");
const onScroll = () => header?.classList.toggle("scrolled", window.scrollY > 10);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* ---------------- Reveal on scroll (repeatable) ---------------- */
const revealEls = $$("[data-animate]");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("seen");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("seen"));
}

/* ---------------- Typewriter ---------------- */
const phases = [
  "moving together.",
  "in motion, always.",
  "alive on your TV.",
  "living on your wall.",
];

{
  const node = $("#typewriter");
  if (node) {
    let phrase = 0;
    let char = 0;
    let deleting = false;

    const type = () => {
      const cur = phases[phrase];
      const active = deleting ? cur.slice(0, char) : cur.slice(0, char);
      node.textContent = active;

      if (!deleting) {
        char += 1;
        if (char === cur.length + 1) {
          deleting = true;
          window.setTimeout(type, 2000);
          return;
        }
      } else {
        char -= 1;
        if (char === 0) {
          deleting = false;
          phrase = (phrase + 1) % phases.length;
        }
      }
      window.setTimeout(type, deleting ? 38 : 78);
    };
    type();
  }
}

/* ---------------- Poster → video swap ---------------- */
/* Only promotes a section to <video> when the demo file actually exists,
   so the site stays fast and clean until the real concierge walls render. */

const slots = $$("[data-video-slot]");
const existsCache = new Map();

function fileExists(url) {
  if (existsCache.has(url)) return Promise.resolve(existsCache.get(url));
  return fetch(url, { method: "HEAD" })
    .then((r) => r.ok)
    .catch(() => false)
    .then((ok) => {
      existsCache.set(url, ok);
      return ok;
    });
}

function activateSlot(el) {
  const src = el.getAttribute("data-src-video");
  const posterEl = el.querySelector(".stage-img") || el;

  fileExists(src).then((exists) => {
    if (!exists) return;

    const vid = document.createElement("video");
    vid.className = "video-el";
    vid.src = src;
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.preload = "metadata";
    vid.setAttribute("aria-hidden", "true");
    vid.autoplay = true;

    posterEl.classList.add("has-video");
    posterEl.appendChild(vid);

    const play = () => {
      const p = vid.play();
      if (p) p.catch(() => {});
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) play();
            else vid.pause();
          }),
        { threshold: 0.15 }
      );
      io.observe(posterEl);
    } else {
      play();
    }
  });
}

if (slots.length && "IntersectionObserver" in window) {
  const first = slots[0];
  // Always attempt the hero on load (it's above the fold).
  activateSlot(first);
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) activateSlot(e.target);
      }),
    { threshold: 0.25 }
  );
  slots.slice(1).forEach((el) => io.observe(el));
} else if (slots.length) {
  slots.forEach(activateSlot);
}

/* ---------------- Beta form ---------------- */
const form = $("#beta-form");
const feedback = $("#beta-feedback");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = $("#f-email").value.trim();
    const tv = $("#f-tv").value;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailOk) {
      form.classList.add("invalid");
      $("#f-email").focus();
      feedback.textContent = "That email doesn't look quite right — mind checking it?";
      feedback.className = "beta-fine err";
      return;
    }
    if (!tv) {
      $("#f-tv").focus();
      feedback.textContent = "Pick your TV so we know which device to target first.";
      feedback.className = "beta-fine err";
      return;
    }

    form.classList.remove("invalid");
    feedback.textContent = "You're on the list. We'll hand-craft a preview wall from your clips. Refundable deposit — keep it if you love it.";
    feedback.className = "beta-fine ok";

    /* Wire this to your signup endpoint / email provider (e.g. Formspree,
       a serverless function, or a Mailchimp audience). The payload:
       { email, tv, source: "momento.tv" } */
    try {
      await fetch("/api/beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tv, source: "momento.tv" }),
      }).catch(() => null);
    } catch {
      /* no-op — front-end confirmation already shown */
    }

    form.reset();
  });
}

/* ---------------- Footer year ---------------- */
const year = $("#year");
if (year) year.textContent = new Date().getFullYear();