import { useEffect, useRef } from "react";
import { useWallpaper } from "../context/WallpaperContext.jsx";
import "../css/wallpaper.css";

// ---------------------------------------------------------------
// URL helper — turn a YouTube watch/short URL into an embed URL
// ---------------------------------------------------------------
export function toEmbedUrl(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const ytHosts = ["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"];
    if (ytHosts.includes(u.hostname)) {
      let id = "";
      if (u.hostname === "youtu.be") id = u.pathname.slice(1);
      else if (u.searchParams.get("v")) id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2];
      if (id) {
        const params = new URLSearchParams({
          autoplay: "1",
          mute: "1",
          loop: "1",
          playlist: id,
          controls: "0",
          showinfo: "0",
          modestbranding: "1",
          playsinline: "1",
        });
        return `https://www.youtube.com/embed/${id}?${params}`;
      }
    }
    return raw;
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------
// Canvas animation styles
// ---------------------------------------------------------------
function makeParticles(w, h) {
  const count = Math.max(30, Math.floor((w * h) / 22000));
  return {
    particles: Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.4,
      hue: 260 + Math.random() * 60,
    })),
  };
}

function drawParticles(ctx, w, h, state, t) {
  const shift = Math.sin(t / 9000) * 40;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${250 + shift}, 45%, 7%)`);
  g.addColorStop(0.5, `hsl(${265 + shift}, 50%, 9%)`);
  g.addColorStop(1, `hsl(${285 + shift}, 55%, 11%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const ps = state.particles;
  for (const p of ps) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -1;
    if (p.y < 0 || p.y > h) p.vy *= -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 80%, 72%, 0.75)`;
    ctx.fill();
  }

  const LINK = 110;
  const LINK_SQ = LINK * LINK;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < LINK_SQ) {
        const alpha = (1 - Math.sqrt(d2) / LINK) * 0.22;
        ctx.strokeStyle = `hsla(270, 80%, 72%, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
}

function makeAurora() {
  return {
    layers: [
      { speed: 0.00030, amp: 40, yFrac: 0.35, hue: 250, alpha: 0.35 },
      { speed: 0.00022, amp: 55, yFrac: 0.55, hue: 280, alpha: 0.30 },
      { speed: 0.00016, amp: 70, yFrac: 0.75, hue: 310, alpha: 0.25 },
    ],
  };
}

function drawAurora(ctx, w, h, state, t) {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, "#0b0f1a");
  base.addColorStop(1, "#05070d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  for (const L of state.layers) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      const y =
        h * L.yFrac +
        Math.sin(x * 0.005 + t * L.speed) * L.amp +
        Math.sin(x * 0.013 - t * L.speed * 1.7) * (L.amp * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, h * L.yFrac - 100, 0, h);
    grad.addColorStop(0, `hsla(${L.hue}, 80%, 65%, ${L.alpha})`);
    grad.addColorStop(1, `hsla(${L.hue}, 80%, 40%, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

function makeStars(w, h) {
  const count = Math.max(80, Math.floor((w * h) / 12000));
  return {
    stars: Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.2,
      tw: Math.random() * Math.PI * 2,
      twSpeed: 0.0008 + Math.random() * 0.002,
      vy: 0.03 + Math.random() * 0.12,
    })),
  };
}

function drawStars(ctx, w, h, state, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#05060a");
  g.addColorStop(1, "#0b0a18");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (const s of state.stars) {
    s.y += s.vy;
    if (s.y > h) {
      s.y = -2;
      s.x = Math.random() * w;
    }
    const a = 0.5 + 0.5 * Math.sin(t * s.twSpeed + s.tw);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(220, 90%, 88%, ${a})`;
    ctx.fill();
  }
}

const CANVAS_STYLES = {
  particles: { init: makeParticles, draw: drawParticles },
  aurora:    { init: makeAurora,    draw: drawAurora },
  stars:     { init: makeStars,     draw: drawStars },
};

function VideoWallpaper({ url }) {
  if (!url) return null;
  const isYouTube = /youtube\.com|youtu\.be/i.test(url);

  if (isYouTube) {
    const embed = toEmbedUrl(url);
    return (
      <iframe
        className="live-wallpaper live-wallpaper-iframe"
        src={embed}
        title="wallpaper"
        frameBorder="0"
        allow="autoplay; encrypted-media"
        aria-hidden="true"
      />
    );
  }

  return (
    <video
      className="live-wallpaper live-wallpaper-video"
      src={url}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
    />
  );
}

/**
 * LiveWallpaper
 * @param {"lobby" | "room"} variant — which wallpaper slice to render
 */
export default function LiveWallpaper({ variant = "lobby" }) {
  const { wallpaper } = useWallpaper(variant);
  const canvasRef = useRef(null);
  const stateRef  = useRef({});

  useEffect(() => {
    const style = CANVAS_STYLES[wallpaper.type];
    if (!style) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width  = w * DPR;
      canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      stateRef.current = style.init(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      style.draw(ctx, w, h, stateRef.current, 0);
    } else {
      const loop = (t) => {
        style.draw(ctx, w, h, stateRef.current, t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [wallpaper.type]);

  if (wallpaper.type === "none") return null;

  if (wallpaper.type === "image") {
    return (
      <div
        className={`live-wallpaper live-wallpaper-image live-wallpaper-${variant}`}
        style={{ backgroundImage: `url("${wallpaper.url}")` }}
        aria-hidden="true"
      />
    );
  }

  if (wallpaper.type === "video") {
    return <VideoWallpaper url={wallpaper.url} />;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`live-wallpaper live-wallpaper-${variant}`}
      aria-hidden="true"
    />
  );
}