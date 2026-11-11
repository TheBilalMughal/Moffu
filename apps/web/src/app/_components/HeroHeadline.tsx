'use client';

import { useEffect, useState } from 'react';

const GHOSTING_LETTERS = ['l','e','f','t',' ','o','n',' ','r','e','a','d'];
const ENDED_LETTERS    = ['R','E','P','L','I','E','D'];
const CYCLE_MS = 4000;

export function HeroHeadline() {
  const [mounted,   setMounted]   = useState(false);
  const [endedDone, setEndedDone] = useState(false);
  const [cycle,     setCycle]     = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setEndedDone(false);

    const t1 = setTimeout(
      () => setEndedDone(true),
      400 + ENDED_LETTERS.length * 70 + 500,
    );
    const t2 = setTimeout(() => {
      setEndedDone(false);
      setCycle(c => c + 1);
    }, CYCLE_MS);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [mounted, cycle]);

  return (
    <>
      <style>{`
        @keyframes eyebrowIn{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes ghostDrift0{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-8px) rotate(-2deg)}}
        @keyframes ghostDrift1{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-5px) rotate(1.5deg)}}
        @keyframes ghostDrift2{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-10px) rotate(-1deg)}}
        @keyframes ghostDrift3{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-6px) rotate(2deg)}}
        @keyframes ghostDrift4{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-9px) rotate(-1.5deg)}}
        @keyframes ghostDrift5{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-4px) rotate(1deg)}}
        @keyframes ghostDrift6{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-7px) rotate(-2.5deg)}}
        @keyframes ghostDrift7{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-11px) rotate(2deg)}}
        @keyframes ghostFade{0%,100%{opacity:0.18}50%{opacity:0.08}}
        @keyframes letterBounce{0%{opacity:0;transform:translateY(50px) scale(0.5)}55%{opacity:1;transform:translateY(-14px) scale(1.15)}75%{transform:translateY(5px) scale(0.96)}90%{transform:translateY(-3px) scale(1.02)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes celebrate{0%,100%{transform:rotate(0deg) scale(1)}15%{transform:rotate(-4deg) scale(1.04)}30%{transform:rotate(4deg) scale(1.04)}45%{transform:rotate(-3deg) scale(1.02)}60%{transform:rotate(3deg) scale(1.02)}75%{transform:rotate(-1deg) scale(1.01)}}
        @keyframes dotBounce{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-18px) scale(1.3)}70%{transform:translateY(4px) scale(0.9)}}
        .eyebrow-anim{animation:eyebrowIn 0.6s ease forwards}
        .ended-celebrate{animation:celebrate 0.6s ease forwards}
      `}</style>

      {/* Eyebrow */}
      <p className={`text-base font-semibold text-[#111827] mb-5 tracking-wide ${mounted ? 'eyebrow-anim opacity-0' : ''}`}>
        bro your reviews are going unanswered,
      </p>

      <h1 key={cycle} className="font-extrabold leading-[0.90] tracking-tight text-[#111827] mb-0">

        {/* left on read — smaller, ghostly drift */}
        <span
          className="block text-[clamp(2rem,6vw,4.5rem)] line-through decoration-[#111827]/10 decoration-[6px]"
          aria-label="left on read"
          style={{ filter: 'blur(0.4px)', textShadow: '0 0 40px rgba(17,24,39,0.12)' }}
        >
          {GHOSTING_LETTERS.map((l, i) =>
            l === ' ' ? (
              <span key={i} style={{ display: 'inline-block', width: '0.35em' }}>&nbsp;</span>
            ) : (
              <span
                key={i}
                className="inline-block"
                style={mounted ? {
                  animation: `ghostDrift${i % 8} ${2.8 + (i % 8) * 0.3}s ease-in-out ${i * 0.12}s infinite,
                               ghostFade ${3.5 + (i % 8) * 0.2}s ease-in-out ${i * 0.1}s infinite`,
                } : {}}
              >
                {l}
              </span>
            )
          )}
        </span>

        {/* REPLIED. — bigger, bounce in then celebrate */}
        <span
          className={`block text-[clamp(4rem,12vw,10rem)] ${endedDone ? 'ended-celebrate' : ''}`}
          aria-label="REPLIED"
        >
          {ENDED_LETTERS.map((letter, i) => {
            const isDot = letter === '.';
            return (
              <span
                key={i}
                className="inline-block"
                style={mounted ? (
                  isDot && endedDone ? {
                    animation: `letterBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) ${400 + i * 70}ms both,
                                 dotBounce 1s cubic-bezier(0.34,1.56,0.64,1) ${400 + ENDED_LETTERS.length * 70 + 600}ms infinite`,
                  } : {
                    animation: `letterBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) ${400 + i * 70}ms both`,
                  }
                ) : {}}
              >
                {letter}
              </span>
            );
          })}
        </span>
      </h1>
    </>
  );
}
