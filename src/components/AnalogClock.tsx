import React, { useState, useEffect, useRef } from 'react';
import { Cpu } from 'lucide-react';

interface AnalogClockProps {
  accentColor?: string;
  glowColor?: string;
  mode?: string;
}

export const AnalogClock: React.FC<AnalogClockProps> = ({ 
  accentColor = '#7afcff',
  glowColor = 'rgba(122, 252, 255, 0.3)',
  mode = 'DEVELOPER'
}) => {
  const [time, setTime] = useState<{
    hours12: number;
    minutes: number;
    seconds: number;
    millis: number;
    period: 'AM' | 'PM';
    dateString: string;
  }>(() => {
    const now = new Date();
    const rawHours = now.getHours();
    return {
      hours12: rawHours % 12 || 12,
      minutes: now.getMinutes(),
      seconds: now.getSeconds(),
      millis: now.getMilliseconds(),
      period: rawHours >= 12 ? 'PM' : 'AM',
      dateString: now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    };
  });

  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    let lastUpdate = 0;

    const animate = (timestamp: number) => {
      // Throttle updates slightly to ~30-60fps for battery efficiency while remaining butter-smooth
      if (timestamp - lastUpdate > 16) {
        lastUpdate = timestamp;
        const now = new Date();
        const rawHours = now.getHours();
        setTime({
          hours12: rawHours % 12 || 12,
          minutes: now.getMinutes(),
          seconds: now.getSeconds(),
          millis: now.getMilliseconds(),
          period: rawHours >= 12 ? 'PM' : 'AM',
          dateString: now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        });
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  // Angles calculation for 12-hour dial
  const smoothSeconds = time.seconds + time.millis / 1000;
  const smoothMinutes = time.minutes + smoothSeconds / 60;
  const smoothHours = (time.hours12 % 12) + smoothMinutes / 60;

  const secondDeg = smoothSeconds * 6; // 360 / 60 = 6 deg per second
  const minuteDeg = smoothMinutes * 6; // 360 / 60 = 6 deg per minute
  const hourDeg = smoothHours * 30;    // 360 / 12 = 30 deg per hour

  // Format 12-hour digital time string (e.g., 02:45 PM)
  const formattedDigital = `${time.hours12.toString().padStart(2, '0')}:${time.minutes
    .toString()
    .padStart(2, '0')} ${time.period}`;

  return (
    <div className="flex flex-col items-center justify-center select-none group">
      {/* Clock Face Container */}
      <div 
        className="relative w-48 h-48 md:w-56 md:h-56 rounded-full flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.08) 0%, rgba(12, 18, 28, 0.85) 60%, rgba(6, 9, 14, 0.95) 100%)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderTop: '1.5px solid rgba(255, 255, 255, 0.25)',
          boxShadow: `0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 0 32px -4px ${glowColor}, inset 0 2px 4px 0 rgba(255, 255, 255, 0.12), inset 0 -6px 12px rgba(0, 0, 0, 0.4)`
        }}
      >
        {/* Subtle Outer Dial Ring */}
        <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />

        {/* 12-Hour Tick Marks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const rotation = i * 30;
          const isMajor = i % 3 === 0; // 12, 3, 6, 9
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex flex-col justify-between py-2.5 pointer-events-none"
              style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
            >
              <div 
                className={`rounded-full transition-all duration-300 ${
                  isMajor 
                    ? 'w-1.5 h-3 bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.4)]' 
                    : 'w-0.5 h-2 bg-white/25'
                }`} 
                style={isMajor ? { backgroundColor: i === 0 ? accentColor : undefined } : undefined}
              />
              <div className="w-0.5 h-1 opacity-0" />
            </div>
          );
        })}

        {/* 12, 3, 6, 9 Hour Numbers */}
        <span className="absolute top-6 text-[11px] font-display font-semibold tracking-wider text-white/90" style={{ color: accentColor }}>12</span>
        <span className="absolute right-6 text-[11px] font-display font-semibold tracking-wider text-white/60">3</span>
        <span className="absolute bottom-6 text-[11px] font-display font-semibold tracking-wider text-white/60">6</span>
        <span className="absolute left-6 text-[11px] font-display font-semibold tracking-wider text-white/60">9</span>

        {/* Center Brahma Logo / Emblem */}
        <div className="absolute top-[38%] flex flex-col items-center gap-0.5 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-white/70" style={{ color: accentColor }} />
            <span className="text-[8px] font-display font-bold uppercase tracking-[0.25em] text-white/70">BRAHMA</span>
          </div>
          <span className="text-[7px] font-mono tracking-widest text-white/40 uppercase">OS</span>
        </div>

        {/* AM / PM Badge */}
        <div className="absolute bottom-[36%] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono text-gray-300 font-semibold tracking-wider">
          {time.period}
        </div>

        {/* ================= CLOCK HANDS ================= */}

        {/* Hour Hand */}
        <div
          className="absolute w-1.5 rounded-full pointer-events-none z-10 origin-bottom"
          style={{
            height: '28%',
            bottom: '50%',
            left: 'calc(50% - 3px)',
            transform: `rotate(${hourDeg}deg)`,
            background: 'linear-gradient(to top, rgba(255, 255, 255, 0.95), rgba(200, 210, 230, 0.8))',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
            transformOrigin: '50% 100%'
          }}
        >
          {/* Luminous Inner Line */}
          <div className="w-0.5 h-1/2 mx-auto mt-1.5 rounded-full bg-white/90" />
        </div>

        {/* Minute Hand */}
        <div
          className="absolute w-1 rounded-full pointer-events-none z-20 origin-bottom"
          style={{
            height: '38%',
            bottom: '50%',
            left: 'calc(50% - 2px)',
            transform: `rotate(${minuteDeg}deg)`,
            background: 'linear-gradient(to top, rgba(255, 255, 255, 0.9), rgba(180, 200, 230, 0.75))',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
            transformOrigin: '50% 100%'
          }}
        >
          {/* Tapered Inlay */}
          <div className="w-0.5 h-2/3 mx-auto mt-1 rounded-full bg-white/80" />
        </div>

        {/* Second Hand (Smooth 60fps Neon Sweep) */}
        <div
          className="absolute w-0.5 rounded-full pointer-events-none z-30 origin-bottom"
          style={{
            height: '44%',
            bottom: '50%',
            left: 'calc(50% - 1px)',
            transform: `rotate(${secondDeg}deg)`,
            backgroundColor: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
            transformOrigin: '50% 100%'
          }}
        >
          {/* Counter-balance tail */}
          <div 
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-3 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </div>

        {/* Center Cap Hub */}
        <div 
          className="absolute w-3.5 h-3.5 rounded-full z-40 shadow-lg flex items-center justify-center"
          style={{
            backgroundColor: '#0c121d',
            border: `1.5px solid ${accentColor}`,
            boxShadow: `0 0 8px ${accentColor}`
          }}
        >
          <div 
            className="w-1.5 h-1.5 rounded-full" 
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>

      {/* Date & 12-Hour Digital Time Pill */}
      <div className="mt-3.5 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full spatial-glass-subtle">
        <span className="text-xs text-gray-300 font-sans font-medium">{time.dateString}</span>
        <span className="w-1 h-1 rounded-full bg-white/20" />
        <span className="text-xs font-mono font-semibold" style={{ color: accentColor }}>
          {formattedDigital}
        </span>
      </div>
    </div>
  );
};
