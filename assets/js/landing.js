/* Landing page interactions: particle/network hero + scroll reveal + count-up.
   Dependency-free vanilla JS. Respects prefers-reduced-motion. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Particle / network hero ---------- */
  function initParticles() {
    var canvas = document.getElementById("ls-hero-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var w, h, dpr, particles, mouse = { x: null, y: null };
    var ACCENT = "56, 225, 198";
    var ACCENT2 = "91, 140, 255";

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeParticles() {
      var count = Math.min(Math.floor((w * h) / 13000), 110);
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 1.8 + 0.8
        });
      }
    }

    function step() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // gentle mouse attraction
        if (mouse.x !== null) {
          var mdx = mouse.x - p.x, mdy = mouse.y - p.y;
          var md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < 160) { p.x += mdx * 0.0009 * (160 - md) / 160 * 6; p.y += mdy * 0.0009 * (160 - md) / 160 * 6; }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + ACCENT + ", 0.85)";
        ctx.fill();
      }
      // links
      for (var a = 0; a < particles.length; a++) {
        for (var b = a + 1; b < particles.length; b++) {
          var dx = particles[a].x - particles[b].x;
          var dy = particles[a].y - particles[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            var alpha = (1 - dist / 130) * 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.strokeStyle = "rgba(" + ACCENT2 + ", " + alpha + ")";
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(step);
    }

    function onResize() { size(); makeParticles(); }
    window.addEventListener("resize", onResize);
    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener("mouseleave", function () { mouse.x = null; mouse.y = null; });

    size();
    makeParticles();
    if (reduceMotion) {
      step(); // draw one frame statically-ish
    } else {
      requestAnimationFrame(step);
    }
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Count-up stats ---------- */
  function initCountUp() {
    var nums = document.querySelectorAll("[data-count]");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      nums.forEach(function (el) { el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || ""); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseFloat(el.getAttribute("data-count"));
        var suffix = el.getAttribute("data-suffix") || "";
        var start = null, dur = 1400;
        function tick(ts) {
          if (!start) start = ts;
          var prog = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - prog, 3);
          el.textContent = (Number.isInteger(target)
            ? Math.round(target * eased)
            : (target * eased).toFixed(1)) + suffix;
          if (prog < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Live IMU / gait signal visualization ---------- */
  function initGaitViz() {
    var canvas = document.getElementById("ls-gait-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var w, h, dpr;
    var t = 0;
    var running = false;

    // Three synthetic IMU traces (accel-like) with a periodic gait cadence.
    var traces = [
      { color: "56, 225, 198", amp: 0.34, freq: 1.0,  phase: 0.0, noise: 0.05, label: "Shank Z" },
      { color: "91, 140, 255", amp: 0.26, freq: 2.0,  phase: 1.1, noise: 0.04, label: "Thigh Y" },
      { color: "245, 196, 90", amp: 0.18, freq: 0.5,  phase: 2.3, noise: 0.03, label: "Foot X" }
    ];

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Gait-like waveform: blends sinusoids + a heel-strike spike each cycle.
    function sample(tr, x) {
      var cycle = (x * tr.freq + tr.phase);
      var base = Math.sin(cycle * Math.PI * 2) * tr.amp;
      var harm = Math.sin(cycle * Math.PI * 4 + 0.6) * tr.amp * 0.3;
      var strikePhase = (cycle % 1 + 1) % 1;
      var strike = Math.exp(-Math.pow((strikePhase - 0.12) * 14, 2)) * tr.amp * 0.9;
      var n = (Math.sin(x * 137.3 + tr.phase * 9) * 0.5) * tr.noise;
      return base + harm + strike + n;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = "rgba(91, 140, 255, 0.10)";
      ctx.lineWidth = 1;
      for (var gx = 0; gx <= w; gx += w / 12) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (var gy = 0; gy <= h; gy += h / 6) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      var mid = h / 2;
      var span = w; // px window
      var pxStep = 2;

      for (var i = 0; i < traces.length; i++) {
        var tr = traces[i];
        ctx.beginPath();
        for (var px = 0; px <= span; px += pxStep) {
          var x = (px / w) * 6 + t; // 6 "seconds" visible, scrolling with t
          var y = mid - sample(tr, x) * h;
          if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
        }
        ctx.strokeStyle = "rgba(" + tr.color + ", 0.95)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(" + tr.color + ", 0.5)";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // leading dot
        var lx = span;
        var lxv = (lx / w) * 6 + t;
        var ly = mid - sample(tr, lxv) * h;
        ctx.beginPath();
        ctx.arc(lx - 1, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + tr.color + ", 1)";
        ctx.fill();
      }

      if (running && !reduceMotion) {
        t += 0.015;
        requestAnimationFrame(draw);
      }
    }

    window.addEventListener("resize", function () { size(); if (!running) draw(); });
    size();

    // Only animate while visible (saves battery / CPU).
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            if (!running) { running = true; requestAnimationFrame(draw); }
          } else { running = false; }
        });
      }, { threshold: 0.2 });
      io.observe(canvas);
    } else {
      running = true; requestAnimationFrame(draw);
    }
    if (reduceMotion) draw();
  }

  function start() { initParticles(); initReveal(); initCountUp(); initGaitViz(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else { start(); }
})();
