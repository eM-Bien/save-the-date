"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

/* ---------- ambient hearts (drift up the whole time) ---------- */

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

const SPRITES = ["/heart-pink.png", "/heart-soft.png", "/heart-white.png"];

/* ---------- pointer trail ---------- */

const TRAIL_LIFETIME = 1100; // ms a trail heart stays alive
const TRAIL_GAP = 45; // ms between spawns
const TRAIL_MIN_DIST = 22; // px the pointer must travel before the next heart
const TRAIL_MAX = 26;

type TrailHeart = { id: number; x: number; y: number; src: string; size: number; tilt: number };

/* ---------- the flood that covers the screen after YES ---------- */

const FLOOD_COLS = 11;
const FLOOD_ROWS = 8;
const FLOOD_SWAP = 950; // ms: swap the content hidden behind the hearts
const FLOOD_END = 1850; // ms: hearts are gone, overlay unmounts

/** Deterministic PRNG so the flood scatter is identical on every render. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type FloodHeart = {
  id: number;
  x: number;
  y: number;
  size: number;
  tilt: number;
  delay: number;
  out: number;
};

const FLOOD: FloodHeart[] = (() => {
  const rand = mulberry32(20260905);
  const hearts: FloodHeart[] = [];
  let id = 0;
  for (let row = 0; row < FLOOD_ROWS; row++) {
    for (let col = 0; col < FLOOD_COLS; col++) {
      const x = (col + 0.5) / FLOOD_COLS + (rand() - 0.5) * (0.7 / FLOOD_COLS);
      const y = (row + 0.5) / FLOOD_ROWS + (rand() - 0.5) * (0.7 / FLOOD_ROWS);
      // Bloom outwards from the middle of the screen, drain back the same way.
      const dist = Math.min(1, Math.hypot(x - 0.5, y - 0.5) / 0.72);
      hearts.push({
        id: id++,
        x: Math.round(x * 1000) / 10,
        y: Math.round(y * 1000) / 10,
        size: 13 + Math.round(rand() * 100) / 10,
        tilt: Math.round((rand() - 0.5) * 50),
        delay: Math.round(dist * 420),
        out: FLOOD_SWAP + 60 + Math.round((1 - dist) * 260),
      });
    }
  }
  return hearts;
})();

/* ---------- Tenor ---------- */

type GifProps = {
  postId: string;
  aspectRatio: number;
  href: string;
  label: string;
  searchHref: string;
  searchLabel: string;
};

/**
 * tenor.com/embed.js only scans the DOM at the moment it runs, so a gif that
 * mounts later (the second screen) needs its own copy of the script. Embeds it
 * has already built carry data-processed="true" and get skipped, so re-running
 * it is safe.
 */
function TenorGif({ postId, aspectRatio, href, label, searchHref, searchLabel }: GifProps) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://tenor.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
    return () => script.remove();
  }, [postId]);

  return (
    <div className={styles.frame}>
      <div className={styles.frameInner} style={{ aspectRatio: `${aspectRatio} / 1` }}>
        <div
          className="tenor-gif-embed"
          data-postid={postId}
          data-share-method="host"
          data-aspect-ratio={aspectRatio}
          data-width="100%"
        >
          <a href={href}>{label}</a>from <a href={searchHref}>{searchLabel}</a>
        </div>
      </div>
    </div>
  );
}

/**
 * The closing line, one <span> per letter: each drops in on a stagger and then
 * keeps bobbing. Letters are hidden from screen readers; the heading carries
 * the whole string via aria-label.
 */
function BigTitle({ text }: { text: string }) {
  let index = 0;

  return (
    <h1 className={`${styles.title} ${styles.bigTitle}`} aria-label={text}>
      {text.split(" ").map((word, w) => (
        <span key={w} className={styles.word}>
          {[...word].map((character, c) => (
            <span
              key={c}
              className={styles.letter}
              style={{ "--i": index++ } as React.CSSProperties}
              aria-hidden="true"
            >
              {character}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

/* ---------- page ---------- */

const GROWTH = 1.35;
const MAX_SCALE = 9;

type Phase = "ask" | "date" | "done";
type SaveState = "idle" | "saving" | "saved" | "error";

const PAGE_BG: Record<Phase, string> = {
  ask: "",
  date: styles.pageLondon,
  done: styles.pageDone,
};

const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Home() {
  const [scale, setScale] = useState(1);
  const [phase, setPhase] = useState<Phase>("ask");
  const [flooding, setFlooding] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [trail, setTrail] = useState<TrailHeart[]>([]);

  const lastSpawn = useRef({ t: 0, x: 0, y: 0 });
  const nextId = useRef(0);

  const canConfirm = Boolean(from && to && to >= from);

  /** Swap screens behind the heart flood, so the change is never seen. */
  function transitionTo(next: Phase) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(next);
      return;
    }

    setFlooding(true);
    window.setTimeout(() => setPhase(next), FLOOD_SWAP);
    window.setTimeout(() => setFlooding(false), FLOOD_END);
  }

  async function saveDates() {
    if (!canConfirm || saveState === "saving" || flooding) return;

    setSaveState("saving");
    setSaveError("");

    try {
      const response = await fetch("/api/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Could not save (${response.status}).`);
      }

      setSaveState("saved");
      transitionTo("done");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save.");
      setSaveState("error");
    }
  }

  /* hearts that follow the cursor */
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
        src: SPRITES[id % SPRITES.length],
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

  function acceptInvite() {
    if (phase !== "ask" || flooding) return;

    transitionTo("date");
  }

  return (
    <main className={`${styles.page} ${PAGE_BG[phase]}`}>
      {/* React hoists these to <head>, so the later backdrops are cached before
          their flood clears. */}
      <link rel="preload" as="image" href="/bg-london.png" />
      <link rel="preload" as="image" href="/bg-packing.png" />

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

      {phase === "done" ? (
        <div className={styles.stage} key="done">
          <TenorGif
            postId="3129149807445986683"
            aspectRatio={1}
            href="https://tenor.com/view/peach-and-goma-peach-goma-white-cat-grey-cat-gif-3129149807445986683"
            label="Peach And Goma White Cat GIF"
            searchHref="https://tenor.com/search/peach+and+goma-gifs"
            searchLabel="Peach And Goma GIFs"
          />

          <BigTitle text="It’s a date!" />

          <p className={styles.chosen}>
            {formatDate(from)} &rarr; {formatDate(to)}
          </p>
        </div>
      ) : phase === "date" ? (
        <div className={styles.stage} key="date">
          <TenorGif
            postId="473400531468754187"
            aspectRatio={1.15476}
            href="https://tenor.com/view/jump-peach-goma-peach-and-goma-peach-goma-gif-473400531468754187"
            label="Jump Peach Goma GIF"
            searchHref="https://tenor.com/search/jump-gifs"
            searchLabel="Jump GIFs"
          />

          <h1 className={styles.title}>We&rsquo;re going to London!</h1>

          <div className={styles.pickRow}>
            <p className={styles.pickLabel}>pick the date!</p>

            <div className={styles.dateFields}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="from">
                  from
                </label>
                <input
                  id="from"
                  type="date"
                  className={styles.dateInput}
                  value={from}
                  min={TODAY}
                  onChange={(event) => {
                    const next = event.target.value;
                    setFrom(next);
                    setSaveState("idle");
                    // Never leave the range inside out.
                    if (to && next && to < next) setTo(next);
                  }}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="to">
                  to
                </label>
                <input
                  id="to"
                  type="date"
                  className={styles.dateInput}
                  value={to}
                  min={from || TODAY}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setSaveState("idle");
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              className={`${styles.btn} ${styles.save}`}
              onClick={saveDates}
              disabled={!canConfirm || saveState === "saving"}
            >
              {saveState === "saving" ? "SAVING…" : "SAVE"}
            </button>

            {saveState === "error" ? <p className={styles.error}>{saveError}</p> : null}
          </div>
        </div>
      ) : (
        <div className={styles.stage} key="ask">
          <TenorGif
            postId="10363911248176285103"
            aspectRatio={1}
            href="https://tenor.com/view/peach-peach-and-goma-aww-amazing-yass-gif-10363911248176285103"
            label="Peach Peach And Goma GIF"
            searchHref="https://tenor.com/search/peach-gifs"
            searchLabel="Peach GIFs"
          />

          <h1 className={styles.title}>Honey, would you like to go to London with me?</h1>

          <div className={styles.buttons}>
            <button
              type="button"
              className={`${styles.btn} ${styles.yes}`}
              style={{ "--scale": scale } as React.CSSProperties}
              onClick={acceptInvite}
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
        </div>
      )}

      {flooding ? (
        <div className={styles.flood} aria-hidden="true">
          {FLOOD.map((heart) => (
            // eslint-disable-next-line @next/next/no-img-element -- same 16x16 sprite, blown up to flood the screen
            <img
              key={heart.id}
              src={SPRITES[heart.id % SPRITES.length]}
              alt=""
              className={styles.floodHeart}
              style={
                {
                  "--x": `${heart.x}%`,
                  "--y": `${heart.y}%`,
                  "--size": `${heart.size}vmin`,
                  "--tilt": `${heart.tilt}deg`,
                  "--delay": `${heart.delay}ms`,
                  "--out": `${heart.out}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}
