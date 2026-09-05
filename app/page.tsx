"use client";

import { useState } from "react";
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
  { src: "/heart-pink.png", x: "6%", size: "26px", dur: "13s", delay: "0s", drift: "22px", top: "18%" },
  { src: "/heart-soft.png", x: "18%", size: "18px", dur: "17s", delay: "3.5s", drift: "-18px", top: "62%" },
  { src: "/heart-white.png", x: "31%", size: "22px", dur: "15s", delay: "7s", drift: "26px", top: "34%" },
  { src: "/heart-pink.png", x: "44%", size: "16px", dur: "19s", delay: "1.5s", drift: "-24px", top: "78%" },
  { src: "/heart-soft.png", x: "57%", size: "28px", dur: "14s", delay: "9s", drift: "20px", top: "12%" },
  { src: "/heart-white.png", x: "69%", size: "18px", dur: "18s", delay: "5s", drift: "-20px", top: "50%" },
  { src: "/heart-pink.png", x: "81%", size: "24px", dur: "16s", delay: "11s", drift: "16px", top: "26%" },
  { src: "/heart-soft.png", x: "92%", size: "20px", dur: "20s", delay: "2.5s", drift: "-14px", top: "70%" },
];

const GROWTH = 1.35;
const MAX_SCALE = 9;

export default function Home() {
  const [scale, setScale] = useState(1);
  const [accepted, setAccepted] = useState(false);

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
