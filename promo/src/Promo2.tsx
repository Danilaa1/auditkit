import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';

export const DURATION2 = 545;

const BG = '#000000';
const FG = '#ffffff';
const MUTED = 'rgba(255,255,255,0.45)';
const FAINT = 'rgba(255,255,255,0.25)';
const BORDER = 'rgba(255,255,255,0.14)';
const GREEN = '#4ade80';
const RED = '#f87171';
const SANS =
  '-apple-system, "Inter", "SF Pro Display", "Segoe UI", Helvetica, sans-serif';
const MONO = '"SF Mono", "JetBrains Mono", Menlo, "Cascadia Code", monospace';

// ------------------------------------------------------------ Scene 1: Timer hook

const TIMER_END = 55; // frames spent spinning the clock up
const CUT = 62; // hard cut to the answer

const pad = (n: number) => String(n).padStart(2, '0');

const TimerHook: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  if (frame < CUT) {
    // Clock spins from 0:00:00 to 2:47:13 — fast and uncomfortable.
    const total = interpolate(frame, [0, TIMER_END], [0, 2 * 3600 + 47 * 60 + 13], {
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.quad),
    });
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    const done = frame >= TIMER_END;
    return (
      <AbsoluteFill style={{background: BG, justifyContent: 'center', alignItems: 'center'}}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 28,
            color: MUTED,
            letterSpacing: '0.35em',
            marginBottom: 60,
          }}
        >
          ONE MANUAL WEBSITE AUDIT
        </div>
        <div
          style={{
            position: 'relative',
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 260,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
            color: done ? RED : FG,
            lineHeight: 1,
          }}
        >
          {h}:{pad(m)}:{pad(s)}
          {done && (
            <div
              style={{
                position: 'absolute',
                left: '-3%',
                top: '50%',
                width: '106%',
                height: 12,
                background: RED,
              }}
            />
          )}
        </div>
      </AbsoluteFill>
    );
  }

  const local = frame - CUT;
  const pop = spring({frame: local, fps, config: {damping: 13, stiffness: 170}});
  const subIn = interpolate(local, [10, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: BG, justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 240,
          color: GREEN,
          letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums',
          transform: `scale(${0.88 + pop * 0.12})`,
          opacity: pop,
          lineHeight: 1,
        }}
      >
        90 seconds.
      </div>
      <div
        style={{
          marginTop: 56,
          fontFamily: SANS,
          fontSize: 48,
          color: FG,
          opacity: subIn,
          transform: `translateY(${(1 - subIn) * 14}px)`,
        }}
      >
        Audit Kit runs the whole thing for you.
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ Scene 2: What runs

const STEPS = [
  {n: '01', cmd: 'check', label: 'HTML & SEO basics — titles, H1s, alt text, CTAs'},
  {n: '02', cmd: 'security', label: 'HSTS, CSP, frame & referrer policies, cookies'},
  {n: '03', cmd: 'lighthouse', label: 'Performance, accessibility, best practices'},
  {n: '04', cmd: 'report', label: 'Final report + ready-to-send client email'},
];

const StepList: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{background: BG, justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 26,
          color: MUTED,
          letterSpacing: '0.35em',
          marginBottom: 70,
          opacity: interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'}),
        }}
      >
        ONE RUN OF `AK INSPECT`
      </div>
      <div style={{width: 1280}}>
        {STEPS.map((step, i) => {
          const start = 8 + i * 14;
          const p = spring({
            frame: frame - start,
            fps,
            config: {damping: 17, stiffness: 150},
          });
          const checkIn = spring({
            frame: frame - start - 10,
            fps,
            config: {damping: 12, stiffness: 220},
          });
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 44,
                padding: '38px 12px',
                borderTop: `1px solid ${BORDER}`,
                borderBottom: i === STEPS.length - 1 ? `1px solid ${BORDER}` : 'none',
                opacity: p,
                transform: `translateX(${(1 - p) * 40}px)`,
              }}
            >
              <div style={{fontFamily: MONO, fontSize: 30, color: FAINT, width: 60}}>
                {step.n}
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 36,
                  color: FG,
                  width: 300,
                }}
              >
                ak {step.cmd}
              </div>
              <div style={{fontFamily: SANS, fontSize: 32, color: MUTED, flex: 1}}>
                {step.label}
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 38,
                  color: GREEN,
                  opacity: checkIn,
                  transform: `scale(${0.6 + checkIn * 0.4})`,
                }}
              >
                ✓
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ Scene 3: Deliverables

const FILES = [
  {name: 'final-report.md', note: 'the full audit, written up'},
  {name: 'client-email.md', note: 'ready to copy & send'},
  {name: 'findings.md', note: 'every issue, prioritised'},
  {name: 'raw/lighthouse.json', note: 'raw scores for receipts'},
];

const Deliverables: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const headIn = spring({frame, fps, config: {damping: 15, stiffness: 130}});

  return (
    <AbsoluteFill style={{background: BG, justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 96,
          color: FG,
          letterSpacing: '-0.03em',
          marginBottom: 80,
          opacity: headIn,
          transform: `translateY(${(1 - headIn) * 20}px)`,
        }}
      >
        Client-ready. Instantly.
      </div>
      <div
        style={{
          width: 1100,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '20px 0',
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: 28,
            color: FAINT,
            padding: '14px 48px',
          }}
        >
          audits/2026-06-11-client/
        </div>
        {FILES.map((file, i) => {
          const start = 14 + i * 9;
          const p = spring({
            frame: frame - start,
            fps,
            config: {damping: 18, stiffness: 180},
          });
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                padding: '16px 48px',
                opacity: p,
                transform: `translateY(${(1 - p) * 12}px)`,
              }}
            >
              <span style={{fontFamily: MONO, fontSize: 32, color: GREEN, marginRight: 24}}>
                ├─
              </span>
              <span style={{fontFamily: MONO, fontSize: 32, color: FG, width: 480}}>
                {file.name}
              </span>
              <span style={{fontFamily: SANS, fontSize: 28, color: MUTED}}>{file.note}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ Scene 4: Three words

const WORDS = ['Free.', 'Local.', 'Open source.'];

const ThreeWords: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: BG,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 70,
      }}
    >
      {WORDS.map((word, i) => {
        const p = spring({
          frame: frame - i * 9,
          fps,
          config: {damping: 13, stiffness: 160},
        });
        return (
          <div
            key={i}
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 130,
              letterSpacing: '-0.04em',
              color: i === WORDS.length - 1 ? GREEN : FG,
              opacity: p,
              transform: `translateY(${(1 - p) * 30}px)`,
            }}
          >
            {word}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ Scene 5: End card

const End: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const titleIn = spring({frame, fps, config: {damping: 15, stiffness: 130}});
  const pillIn = spring({frame: frame - 12, fps, config: {damping: 16, stiffness: 140}});
  const cursorOn = Math.floor(frame / 12) % 2 === 0;

  return (
    <AbsoluteFill style={{background: BG, justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 150,
          color: FG,
          letterSpacing: '-0.04em',
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 24}px)`,
        }}
      >
        Audit Kit
      </div>
      <div
        style={{
          marginTop: 24,
          fontFamily: SANS,
          fontSize: 38,
          color: MUTED,
          opacity: titleIn,
        }}
      >
        Stop auditing by hand.
      </div>
      <div
        style={{
          marginTop: 80,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: '26px 48px',
          fontFamily: MONO,
          fontSize: 40,
          color: FG,
          opacity: pillIn,
          transform: `translateY(${(1 - pillIn) * 16}px)`,
        }}
      >
        <span style={{color: MUTED}}>$ </span>npm install -g auditkit
        <span style={{opacity: cursorOn ? 1 : 0, color: GREEN}}> ▋</span>
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------ Timeline

export const Promo2: React.FC = () => {
  return (
    <AbsoluteFill style={{background: BG}}>
      <Sequence durationInFrames={120}>
        <TimerHook />
      </Sequence>
      <Sequence from={120} durationInFrames={140}>
        <StepList />
      </Sequence>
      <Sequence from={260} durationInFrames={120}>
        <Deliverables />
      </Sequence>
      <Sequence from={380} durationInFrames={70}>
        <ThreeWords />
      </Sequence>
      <Sequence from={450} durationInFrames={95}>
        <End />
      </Sequence>
    </AbsoluteFill>
  );
};
