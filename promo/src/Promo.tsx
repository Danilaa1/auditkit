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

export const DURATION = 550;

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

// ---------------------------------------------------------------- Scene 1: Hook

const FLASH_WORDS = ['HTML.', 'Security.', 'Lighthouse.', 'Reports.'];
const FLASH_LEN = 12;

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  if (frame < FLASH_WORDS.length * FLASH_LEN) {
    const i = Math.floor(frame / FLASH_LEN);
    const local = frame - i * FLASH_LEN;
    const scale = interpolate(local, [0, FLASH_LEN], [1, 1.04], {
      easing: Easing.out(Easing.quad),
    });
    return (
      <AbsoluteFill style={{background: BG, justifyContent: 'center', alignItems: 'center'}}>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 200,
            color: FG,
            letterSpacing: '-0.04em',
            transform: `scale(${scale})`,
          }}
        >
          {FLASH_WORDS[i]}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            fontFamily: MONO,
            fontSize: 28,
            color: FAINT,
            letterSpacing: '0.3em',
          }}
        >
          {FLASH_WORDS.map((_, j) => (j === i ? '●' : '○')).join('  ')}
        </div>
      </AbsoluteFill>
    );
  }

  const local = frame - FLASH_WORDS.length * FLASH_LEN;
  const pop = spring({frame: local, fps, config: {damping: 14, stiffness: 160}});
  const subIn = interpolate(local, [12, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: BG, justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 200,
          color: FG,
          letterSpacing: '-0.04em',
          transform: `scale(${0.9 + pop * 0.1})`,
          opacity: pop,
        }}
      >
        One command.
      </div>
      <div
        style={{
          marginTop: 48,
          fontFamily: MONO,
          fontSize: 44,
          color: GREEN,
          opacity: subIn,
          transform: `translateY(${(1 - subIn) * 16}px)`,
        }}
      >
        $ ak check
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Scene 2: Terminal

type Line = {mark: '✓' | '✗' | ''; text: string; color?: string};

const LINES: Line[] = [
  {mark: '✓', text: 'HTTP 200 · responded in 0.4s'},
  {mark: '✓', text: 'Title tag found'},
  {mark: '✓', text: 'Meta description found'},
  {mark: '✓', text: 'Single H1 found'},
  {mark: '✗', text: '3 images missing alt text', color: RED},
  {mark: '✓', text: 'Security headers · 5/5'},
  {mark: '✓', text: 'Lighthouse performance · 98'},
  {mark: '', text: 'saved automated-check.md', color: GREEN},
];

const CMD = 'ak check https://client.com';
const TYPE_START = 8;
const TYPE_SPEED = 1.4; // chars per frame
const LINES_START = TYPE_START + Math.ceil(CMD.length / TYPE_SPEED) + 8;
const LINE_GAP = 9;

const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const winIn = spring({frame, fps, config: {damping: 16, stiffness: 140}});
  const typed = CMD.slice(
    0,
    Math.max(0, Math.floor((frame - TYPE_START) * TYPE_SPEED))
  );
  const cursorOn = Math.floor(frame / 12) % 2 === 0;

  return (
    <AbsoluteFill style={{background: BG, justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 1240,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          background: BG,
          opacity: winIn,
          transform: `translateY(${(1 - winIn) * 30}px)`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '18px 24px',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                background: 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: MONO,
              fontSize: 22,
              color: FAINT,
              marginRight: 62,
            }}
          >
            auditkit
          </div>
        </div>
        <div style={{padding: '36px 44px 44px', fontFamily: MONO, fontSize: 30, lineHeight: 1.9}}>
          <div style={{color: FG}}>
            <span style={{color: MUTED}}>$ </span>
            {typed}
            {typed.length < CMD.length && (
              <span style={{opacity: cursorOn ? 1 : 0, color: FG}}>▋</span>
            )}
          </div>
          {LINES.map((line, i) => {
            const start = LINES_START + i * LINE_GAP;
            const p = spring({
              frame: frame - start,
              fps,
              config: {damping: 18, stiffness: 200},
            });
            if (frame < start) return <div key={i} style={{height: 57}} />;
            return (
              <div
                key={i}
                style={{
                  opacity: p,
                  transform: `translateY(${(1 - p) * 10}px)`,
                  color: line.color ?? 'rgba(255,255,255,0.85)',
                }}
              >
                <span
                  style={{
                    color: line.mark === '✗' ? RED : GREEN,
                    marginRight: 18,
                  }}
                >
                  {line.mark || '→'}
                </span>
                {line.text}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Scene 3: Stats

const STATS = [
  {value: 4, suffix: '', label: 'audit types in one CLI'},
  {value: 5, suffix: '', label: 'security headers checked'},
  {value: 10, suffix: '+', label: 'HTML & SEO checks'},
];

const Stats: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill
      style={{background: BG, justifyContent: 'center', alignItems: 'center'}}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 26,
          color: MUTED,
          letterSpacing: '0.35em',
          marginBottom: 90,
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateRight: 'clamp',
          }),
        }}
      >
        EVERY RUN. EVERY SITE.
      </div>
      <div style={{display: 'flex', alignItems: 'stretch'}}>
        {STATS.map((stat, i) => {
          const start = 6 + i * 8;
          const p = spring({
            frame: frame - start,
            fps,
            config: {damping: 16, stiffness: 120},
          });
          const count = Math.round(
            interpolate(frame - start, [0, 30], [0, stat.value], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            })
          );
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div style={{width: 1, background: BORDER, margin: '10px 0'}} />
              )}
              <div
                style={{
                  width: 460,
                  textAlign: 'center',
                  opacity: p,
                  transform: `translateY(${(1 - p) * 24}px)`,
                  padding: '0 30px',
                }}
              >
                <div
                  style={{
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: 170,
                    color: FG,
                    letterSpacing: '-0.03em',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {count}
                  {stat.suffix}
                </div>
                <div
                  style={{
                    marginTop: 28,
                    fontFamily: SANS,
                    fontSize: 32,
                    color: MUTED,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 100,
          fontFamily: MONO,
          fontSize: 28,
          color: FAINT,
          opacity: interpolate(frame, [40, 55], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        check · security · lighthouse · inspect · report
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Scene 4: End card

const End: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const titleIn = spring({frame, fps, config: {damping: 15, stiffness: 130}});
  const pillIn = spring({
    frame: frame - 14,
    fps,
    config: {damping: 16, stiffness: 140},
  });

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
        Fast local website audits for freelancers and agencies.
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
      </div>
      <div
        style={{
          marginTop: 56,
          fontFamily: MONO,
          fontSize: 24,
          color: FAINT,
          letterSpacing: '0.2em',
          opacity: pillIn,
        }}
      >
        MIT · OPEN SOURCE
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- Timeline

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: BG}}>
      <Sequence durationInFrames={90}>
        <Hook />
      </Sequence>
      <Sequence from={90} durationInFrames={210}>
        <Terminal />
      </Sequence>
      <Sequence from={300} durationInFrames={135}>
        <Stats />
      </Sequence>
      <Sequence from={435} durationInFrames={115}>
        <End />
      </Sequence>
    </AbsoluteFill>
  );
};
