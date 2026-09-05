"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import styles from "./page.module.css";

type Heart = {
  src: string;
  x: string;
  size: string;
  dur: string;
  delay: string;
  drift: string;
  top: string;
};

/* Fixed values (not random) so server and client markup match. */
const HEARTS: Heart[] = [
  { src: "/heart-pink.png", x: "6%", size: "40px", dur: "13s", delay: "0s", drift: "22px", top: "18%" },
  { src: "/heart-soft.png", x: "18%", size: "30px", dur: "17s", delay: "3.5s", drift: "-18px", top: "62%" },
  { src: "/heart-white.png", x: "31%", size: "34px", dur: "15s", delay: "7s", drift: "26px", top: "34%" },
  { src: "/heart-pink.png", x: "44%", size: "26px", dur: "19s", delay: "1.5s", drift: "-24px", top: "78%" },
  { src: "/heart-soft.png", x: "57%", size: "44px", dur: "14s", delay: "9s", drift: "20px", top: "12%" },
  { src: "/heart-white.png", x: "69%", size: "30px", dur: "18s", delay: "5s", drift: "-20px", top: "50%" },
  { src: "/heart-pink.png", x: "81%", size: "38px", dur: "16s", delay: "11s", drift: "16px", top: "26%" },
  { src: "/heart-soft.png", x: "92%", size: "32px", dur: "20s", delay: "2.5s", drift: "-14px", top: "70%" },
];

const TRAIL_SRC = ["/heart-pink.png", "/heart-soft.png", "/heart-white.png"];
const TRAIL_LIFETIME = 1100; // ms a trail heart stays alive
const TRAIL_GAP = 45; // ms between spawns
const TRAIL_MIN_DIST = 22; // px the pointer must travel before the next heart
const TRAIL_MAX = 26;

type TrailHeart = { id: number; x: number; y: number; src: string; size: number; tilt: number };

const GROWTH = 1.35;
const MAX_SCALE = 9;

export default function Home() {
  const [scale, setScale] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [trail, setTrail] = useState<TrailHeart[]>([]);

  const lastSpawn = useRef({ t: 0, x: 0, y: 0 });
  const nextId = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timers = new Set<number>();

    const onMove = (event: PointerEvent) => {
      const now = performance.now();
      const last = lastSpawn.current;
      const moved = Math.hypot(event.clientX - last.x, event.clientY - last.y);
      if (now - last.t < TRAIL_GAP || moved < TRAIL_MIN_DIST) return;

      lastSpawn.current = { t: now, x: event.clientX, y: event.clientY };
      const id = nextId.current++;
      const heart: TrailHeart = {
        id,
        x: event.clientX,
        y: event.clientY,
        src: TRAIL_SRC[id % TRAIL_SRC.length],
        size: 22 + (id % 3) * 7,
        tilt: ((id % 5) - 2) * 9,
      };

      setTrail((current) => [...current.slice(-(TRAIL_MAX - 1)), heart]);

      const timer = window.setTimeout(() => {
        timers.delete(timer);
        setTrail((current) => current.filter((h) => h.id !== id));
      }, TRAIL_LIFETIME);
      timers.add(timer);
    };

    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.hearts} aria-hidden="true">
        {HEARTS.map((heart, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- 16x16 pixel sprites; next/image would add overhead for a 148-byte decorative asset
          <img
            key={i}
            src={heart.src}
            alt=""
            className={styles.heart}
            style={
              {
                "--x": heart.x,
                "--size": heart.size,
                "--dur": heart.dur,
                "--delay": heart.delay,
                "--drift": heart.drift,
                "--top": heart.top,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.trail} aria-hidden="true">
        {trail.map((heart) => (
          // eslint-disable-next-line @next/next/no-img-element -- same 16x16 sprite, spawned per pointer move
          <img
            key={heart.id}
            src={heart.src}
            alt=""
            className={styles.trailHeart}
            style={
              {
                left: `${heart.x}px`,
                top: `${heart.y}px`,
                "--size": `${heart.size}px`,
                "--tilt": `${heart.tilt}deg`,
                "--life": `${TRAIL_LIFETIME}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className={styles.frame}>
        <div className={styles.frameInner}>
          <div
            className="tenor-gif-embed"
            data-postid="17843851"
            data-share-method="host"
            data-aspect-ratio="1.02894"
            data-width="100%"
          >
            <a href="https://tenor.com/view/mochi-mochi-peach-cat-kitty-chibi-cute-gif-17843851">
              Mochi Mochi Peach Cat Sticker
            </a>
            from <a href="https://tenor.com/search/mochi+mochi-stickers">Mochi Mochi Stickers</a>
          </div>
        </div>
      </div>

      <h1 className={styles.title}>Honey, would you like to go to London with me?</h1>

      {accepted ? (
        <p className={styles.yay}>Yay! London, here we come!</p>
      ) : (
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.btn} ${styles.yes}`}
            style={{ "--scale": scale } as React.CSSProperties}
            onClick={() => setAccepted(true)}
          >
            YES
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.no}`}
            onClick={() => setScale((s) => Math.min(s * GROWTH, MAX_SCALE))}
          >
            NO
          </button>
        </div>
      )}

      <Script src="https://tenor.com/embed.js" strategy="afterInteractive" />
    </main>
  );
}
