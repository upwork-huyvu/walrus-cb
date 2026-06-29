import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView,
  SafeAreaView, StatusBar, Dimensions, Image, Animated, TextInput,
} from 'react-native';
import Svg, { Circle, Path as SvgPath } from 'react-native-svg';
import * as Font from 'expo-font';

// ─── Font URLs ────────────────────────────────────────────────────────────────
const FONTS = {
  'SangBleu-Regular': { uri: 'https://www.dropbox.com/scl/fi/lqe1umkpc3n0eo8tz2ceh/SangBleuSunrise-Regular.otf?rlkey=s0pelwktkc3y9n74i44w3gc12&dl=1' },
  'SangBleu-Medium':  { uri: 'https://www.dropbox.com/scl/fi/dbbnb9rpj4hvw4iaelbz6/SangBleuSunrise-Medium.otf?rlkey=8j5jrvozqgeyj51xma5fqqgdm&dl=1' },
  'Suisse-Regular':   { uri: 'https://www.dropbox.com/scl/fi/epztvgrulu8eae3xdzbql/SuisseIntl-Regular.otf?rlkey=iaq8psfxbiolmkjdro8dwoxta&dl=1' },
};

const { width: SW } = Dimensions.get('window');

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const DARK_THEME = {
  bg:     '#0A0A0F',
  white:  '#F5ECD7',
  ochre:  '#C4873A',
  muted:  'rgba(245,236,215,0.4)',
  border: 'rgba(245,236,215,0.15)',
};

const LIGHT_THEME = {
  bg:     '#E8E2DA',
  white:  '#1C1712',
  ochre:  '#C4873A',
  muted:  'rgba(28,23,18,0.5)',
  border: 'rgba(28,23,18,0.18)',
};

// Separate context for the toggle function — keeps it stable
const ThemeToggleContext = React.createContext(() => {});
const ThemeContext = React.createContext(DARK_THEME);
const useTheme = () => React.useContext(ThemeContext);
const useToggleTheme = () => React.useContext(ThemeToggleContext);

// For backwards compatibility, C is still used throughout —
// each component reads from context via useTheme()

// ─── Font helpers ─────────────────────────────────────────────────────────────
// Headlines, large numbers → SangBleu-Regular
// Subheadings              → SangBleu-Medium
// Body, labels, buttons    → Suisse-Regular
const F = {
  headline: 'SangBleu-Regular',
  medium:   'SangBleu-Medium',
  body:     'Suisse-Regular',
};
function useAppState() {
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalMinutes, setTotalMinutes]   = useState(0);
  const [streak, setStreak]               = useState(0);
  const [ritualPoints, setRitualPoints]   = useState(0);
  const [lastDate, setLastDate]           = useState(null);
  const [completedBreathworks, setCompletedBreathworks] = useState(0);
  const [lastSessionPoints, setLastSessionPoints] = useState(0);

  // Device state — replaced by Tuya SDK later
  const [deviceConnected, setDeviceConnected] = useState(true);
  const [currentTemp, setCurrentTemp]         = useState(12);
  const [targetTemp, setTargetTemp_] = useState(6);
  const [lightOn, setLightOn]                 = useState(false);

  const completeSession = (seconds) => {
    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let newStreak = 1;
    if (lastDate === today)      newStreak = streak;
    else if (lastDate === yesterday) newStreak = streak + 1;

    const multiplier = getStreakMultiplier(newStreak);
    const pointsEarned = Math.round(seconds * multiplier);

    setTotalSessions(s => s + 1);
    setTotalMinutes(m => m + Math.round(seconds / 60));
    setStreak(newStreak);
    setLastDate(today);
    setRitualPoints(p => p + pointsEarned);
    setLastSessionPoints(pointsEarned);
  };

  // Simulate connection — replace with Tuya SDK call later
  const connectDevice = () => {
    setDeviceConnected(true);
    setCurrentTemp(12);
    setTargetTemp_(6);
    setLightOn(false);
  };

  const disconnectDevice = () => {
    setDeviceConnected(false);
    setCurrentTemp(null);
    setTargetTemp_(null);
  };

  const toggleLight = () => setLightOn(l => !l);
  const setTargetTemp = (temp) => setTargetTemp_(Math.max(-3, Math.min(12, temp)));

  const completeBreathwork = (rounds = 1) => {
    setCompletedBreathworks(b => b + 1);
    const multiplier = getStreakMultiplier(streak);
    const points = Math.round(rounds * 10 * multiplier);
    setRitualPoints(p => p + points);
  };

  return {
    totalSessions, totalMinutes, streak, ritualPoints, completeSession,
    lastSessionPoints,
    completedBreathworks, completeBreathwork,
    deviceConnected, currentTemp, targetTemp, lightOn,
    connectDevice, disconnectDevice, toggleLight, setTargetTemp,
  };
}

// ─── Level system ─────────────────────────────────────────────────────────────
const LEVEL_NAMES = [
  '', // index 0 unused
  'Still Dressed',          // 1
  'Hesitant Dipper',        // 2
  'Toe Tester',             // 3
  'Reluctant Plunger',      // 4
  'Brave Beginner',         // 5
  'Chill Seeker',           // 6
  'Cold Curious',           // 7
  'Shiver Starter',         // 8
  'Ice Initiate',           // 9
  'Frosty Newcomer',        // 10
  'Cold Convert',           // 11
  'Plunge Regular',         // 12
  'Chill Enthusiast',       // 13
  'Ice Apprentice',         // 14
  'Cold Committed',         // 15
  'Frost Follower',         // 16
  'Icy Devotee',            // 17
  'Cold Blooded',           // 18
  'Polar Pupil',            // 19
  'Arctic Aspirant',        // 20
  'Cold Tactician',         // 21
  'Ice Veteran',            // 22
  'Frost Faithful',         // 23
  'Plunge Pro',             // 24
  'Chill Master',           // 25
  'Cold Operator',          // 26
  'Arctic Adept',           // 27
  'Ice Strategist',         // 28
  'Frost Commander',        // 29
  'Cold Authority',         // 30
  'Polar Practitioner',     // 31
  'Ice Specialist',         // 32
  'Arctic Expert',          // 33
  'Frost Veteran',          // 34
  'Cold Sage',              // 35
  'Plunge Scholar',         // 36
  'Ice Philosopher',        // 37
  'Frost Thinker',          // 38
  'Arctic Sage',            // 39
  'Cold Luminary',          // 40
  'Polar Intellectual',     // 41
  'Ice Elder',              // 42
  'Frost Keeper',           // 43
  'Arctic Steward',         // 44
  'Cold Guardian',          // 45
  'Polar Sentinel',         // 46
  'Ice Warden',             // 47
  'Frost Champion',         // 48
  'Arctic Defender',        // 49
  'Frost Warrior',          // 50
  'Cold Crusader',          // 51
  'Ice Knight',             // 52
  'Polar Paladin',          // 53
  'Arctic Avenger',         // 54
  'Frost Fighter',          // 55
  'Cold Gladiator',         // 56
  'Ice Centurion',          // 57
  'Polar Protector',        // 58
  'Arctic Titan',           // 59
  'Cold Colossus',          // 60
  'Ice Overlord',           // 61
  'Frost Sovereign',        // 62
  'Polar Ruler',            // 63
  'Arctic Monarch',         // 64
  'Cold Emperor',           // 65
  'Ice Regent',             // 66
  'Frost Lord',             // 67
  'Polar Warlord',          // 68
  'Arctic Conqueror',       // 69
  'Cold Vanquisher',        // 70
  'Ice Dominator',          // 71
  'Frost Subjugator',       // 72
  'Polar Supremacy',        // 73
  'Arctic Pinnacle',        // 74
  'Cold Summit',            // 75
  'Ice Apex',               // 76
  'Frost Zenith',           // 77
  'Polar Peak',             // 78
  'Arctic Crest',           // 79
  'Cold Ascendant',         // 80
  'Ice Transcendent',       // 81
  'Frost Enlightened',      // 82
  'Polar Illuminated',      // 83
  'Arctic Awakened',        // 84
  'Cold Evolved',           // 85
  'Ice Transformed',        // 86
  'Frost Metamorphosed',    // 87
  'Polar Transfigured',     // 88
  'Arctic Elevated',        // 89
  'Cold Exalted',           // 90
  'Ice Glorified',          // 91
  'Frost Hallowed',         // 92
  'Polar Revered',          // 93
  'Arctic Venerated',       // 94
  'Cold Immortal',          // 95
  'Ice Eternal',            // 96
  'Frost Infinite',         // 97
  'Polar Boundless',        // 98
  'Arctic Limitless',       // 99
  'Arctic Regular',         // 100
];

// For levels above 100, generate names dynamically
function getLevelName(level) {
  if (level <= 100) return LEVEL_NAMES[level] || `Level ${level}`;
  if (level <= 150) return 'Seasoned Plunger';
  if (level <= 200) return 'Cold Monk';
  if (level <= 250) return 'Ice Mystic';
  if (level <= 300) return 'Polar Prophet';
  if (level <= 400) return 'Arctic Oracle';
  if (level <= 500) return 'Polar Legend';
  if (level <= 600) return 'Frost Deity';
  if (level <= 700) return 'Ice Immortal';
  if (level <= 800) return 'Arctic God';
  if (level <= 900) return 'Polar Absolute';
  return 'The Walrus';
}

// ─── Points per threshold for levelling up ────────────────────────────────────
// Level 1→2 = 300 pts, each subsequent level needs ~1.4x more
function pointsForLevel(level) {
  return Math.round(300 * Math.pow(1.4, level - 1));
}

function getLevelFromPoints(totalPoints) {
  let level = 1;
  let remaining = totalPoints;
  while (remaining >= pointsForLevel(level)) {
    remaining -= pointsForLevel(level);
    level++;
  }
  return { level, pointsInLevel: remaining, pointsNeeded: pointsForLevel(level) };
}

// ─── Streak multiplier ────────────────────────────────────────────────────────
function getStreakMultiplier(streak) {
  if (streak >= 14) return 3.0;
  if (streak >= 7)  return 2.5;
  if (streak >= 4)  return 2.0;
  if (streak >= 2)  return 1.5;
  return 1.0;
}
const TECHNIQUES = [
  {
    id: 'box',
    name: 'Focus',
    subtitle: 'Calm your mind',
    description: 'Four counts in. Four counts held. Four counts out. A rhythm that returns you to yourself.',
    phases: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold',   duration: 4 },
      { label: 'Exhale', duration: 4 },
      { label: 'Hold',   duration: 4 },
    ],
    rounds: 6,
    mode: 'fixed',
  },
  {
    id: 'power',
    name: 'Power',
    subtitle: 'Charge your body',
    description: 'Thirty deep breaths. Then silence. Hold as long as you can — this is where the work begins.',
    phases: [],
    rounds: 3,
    mode: 'wim',
  },
  {
    id: 'calm',
    name: 'Recovery',
    subtitle: 'Settle your nervous system',
    description: 'Breathe in slowly. Let the exhale carry twice as long. Step into the cold already at ease.',
    phases: [
      { label: 'Inhale', duration: 4 },
      { label: 'Exhale', duration: 8 },
    ],
    rounds: 8,
    mode: 'fixed',
  },
];

// ─── Breathing pulse circle ───────────────────────────────────────────────────
// Expands on inhale, holds, contracts on exhale — circle IS the guide
function BreathingCircle({
 phase, duration, isPlaying, circleColor, children }) {
  const C = useTheme();
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const glowOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scaleAnim.stopAnimation();
    glowOpacity.stopAnimation();

    if (!isPlaying) {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 1,   duration: 600, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0,   duration: 600, useNativeDriver: true }),
      ]).start();
      return;
    }

    const ms = duration * 1000;

    if (phase === 'Inhale') {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 1.22, duration: ms, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.55, duration: ms, useNativeDriver: true }),
      ]).start();
    } else if (phase === 'Exhale') {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 0.82, duration: ms, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.05, duration: ms, useNativeDriver: true }),
      ]).start();
    } else if (phase === 'Hold') {
      // Stay at current size — just glow steadily
      Animated.timing(glowOpacity, { toValue: 0.45, duration: 600, useNativeDriver: true }).start();
    } else {
      // Recovery — stay constant, soft glow
      Animated.timing(glowOpacity, { toValue: 0.2, duration: 800, useNativeDriver: true }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isPlaying, duration]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 260, height: 260 }}>
      {/* Outer glow — opacity only, native driver safe */}
      <Animated.View style={{
        position: 'absolute',
        width: 260, height: 260, borderRadius: 130,
        backgroundColor: circleColor,
        opacity: glowOpacity,
        transform: [{ scale: scaleAnim }],
      }} />
      {/* Main circle — scales with same value, no conflict */}
      <Animated.View style={{
        width: 220, height: 220, borderRadius: 110,
        borderWidth: 1.5,
        borderColor: circleColor,
        backgroundColor: 'rgba(10,10,15,0.92)',
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 24,
        transform: [{ scale: scaleAnim }],
      }}>
        {children}
      </Animated.View>
    </View>
  );
}
// ─── Wave circle — smooth continuous ocean swells + rising water ──────────────
function WaterCircle({
 isActive, elapsed, maxSeconds, children }) {
  const C = useTheme();
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const frameRef    = useRef(null);
  const offsetRef   = useRef(0);
  const elapsedRef  = useRef(elapsed ?? 0);
  const [svgData, setSvgData] = React.useState({ p1:'', p2:'', p3:'', fill:'' });

  const SIZE = 260;
  const CX   = SIZE / 2;
  const CY   = SIZE / 2;
  const R    = 106;
  const PTS  = 200;
  const MAX  = maxSeconds ?? 180;

  // Keep elapsed in a ref so the RAF loop always sees the latest value
  useEffect(() => { elapsedRef.current = elapsed ?? 0; }, [elapsed]);

  const buildWave = (offset, amp, freq) => {
    let d = '';
    for (let i = 0; i <= PTS; i++) {
      const angle = (i / PTS) * 2 * Math.PI;
      const r = R + amp * Math.sin(freq * angle + offset);
      const x = (CX + r * Math.cos(angle - Math.PI / 2)).toFixed(2);
      const y = (CY + r * Math.sin(angle - Math.PI / 2)).toFixed(2);
      d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
    }
    return d + 'Z';
  };

  const buildFill = (ratio, waveOffset) => {
    const r = Math.max(0.01, Math.min(ratio, 1));
    const fillY = CY + R - r * R * 2;
    const pts = 8; // fewer points, smooth bezier between them
    const segW = (R * 2) / pts;
    const startX = CX - R;

    // Start bottom-left corner
    let d = `M${(startX).toFixed(2)} ${(CY + R + 2).toFixed(2)}`;
    // Up to wave start
    d += ` L${(startX).toFixed(2)} ${(fillY).toFixed(2)}`;

    // Smooth bezier wave across the top
    for (let i = 0; i < pts; i++) {
      const x1 = startX + (i + 1) * segW;
      const cp1x = (startX + i * segW + segW / 3).toFixed(2);
      const cp2x = (x1 - segW / 3).toFixed(2);
      const cp1y = (fillY + 7 * Math.sin(((i + 0.33) / pts) * Math.PI * 3.5 + waveOffset)).toFixed(2);
      const cp2y = (fillY + 7 * Math.sin(((i + 0.66) / pts) * Math.PI * 3.5 + waveOffset)).toFixed(2);
      const endY = (fillY + 7 * Math.sin(((i + 1) / pts) * Math.PI * 3.5 + waveOffset)).toFixed(2);
      d += ` C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x1.toFixed(2)} ${endY}`;
    }

    // Down and close
    d += ` L${(CX + R + 2).toFixed(2)} ${(CY + R + 2).toFixed(2)} Z`;
    return d;
  };

  const loop = () => {
    offsetRef.current += 0.010;
    const o = offsetRef.current;
    const ratio = Math.min(elapsedRef.current / MAX, 1);
    setSvgData({
      p1:   buildWave(o,               20, 3),
      p2:   buildWave(o * 0.6 + 1.05,  13, 5),
      p3:   buildWave(o * 0.35 + 2.1,   7, 7),
      fill: buildFill(ratio, o * 3),
    });
    frameRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (isActive) {
      Animated.timing(glowOpacity, { toValue: 1, duration: 1400, useNativeDriver: true }).start();
      if (!frameRef.current) frameRef.current = requestAnimationFrame(loop);
    } else {
      Animated.timing(glowOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }).start();
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    }
    return () => {
      if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const { Defs, ClipPath } = require('react-native-svg');

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: SIZE, height: SIZE }}>
      <Animated.View style={{ position: 'absolute', opacity: glowOpacity }}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <ClipPath id="wclip">
              <Circle cx={CX} cy={CY} r={R - 2} />
            </ClipPath>
          </Defs>
          {/* Rising water — clipped to circle shape */}
          <SvgPath d={svgData.fill} fill="rgba(196,135,58,0.18)" clipPath="url(#wclip)" />
          {/* Soft base tint */}
          <Circle cx={CX} cy={CY} r={R - 6} fill="rgba(196,135,58,0.04)" />
          {/* Outer wave rings */}
          <SvgPath d={svgData.p3} fill="none" stroke="#C4873A" strokeWidth="1"   opacity="0.2" />
          <SvgPath d={svgData.p2} fill="none" stroke="#C4873A" strokeWidth="2"   opacity="0.4" />
          <SvgPath d={svgData.p1} fill="none" stroke="#C4873A" strokeWidth="3"   opacity="0.75" />
        </Svg>
      </Animated.View>
      {/* Static border */}
      <View style={{
        position: 'absolute', width: R * 2, height: R * 2, borderRadius: R,
        borderWidth: 1, borderColor: 'rgba(196,135,58,0.2)', overflow: 'hidden',
      }} />
      {/* Content */}
      <View style={{
        width: R * 2 - 8, height: R * 2 - 8, borderRadius: R,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
      }}>
        {children}
      </View>
    </View>
  );
}
const LOGO_URI       = 'https://www.dropbox.com/scl/fi/dx2z893cur4m811lhyjj6/Composite-Mark-Ochre.png?rlkey=puv93vhjwd0dgt01xsfxnk2or&dl=1';
const LOGO_URI_LIGHT = 'https://www.dropbox.com/scl/fi/2rr7k4dflx2chui0slukd/Composite-Mark-Black-Cedar.png?rlkey=hxmzpj5khud1szoew4yjm4kqr&dl=1';
function pad(n) { return n.toString().padStart(2, '0'); }
function formatTime(s) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }

// ─── Shared components ────────────────────────────────────────────────────────
function PrimaryButton({
 label, onPress }) {
  const C = useTheme();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={{
        backgroundColor: pressed ? '#A36A28' : C.ochre,
        borderRadius: 14, paddingVertical: 20, alignItems: 'center',
      }}
    >
      <Text style={{ color: C.white, fontSize: 15, fontFamily: F.body, letterSpacing: 0.5 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function GhostButton({
 label, onPress }) {
  const C = useTheme();
  return (
    <Pressable onPress={onPress} style={{ padding: 16, alignItems: 'center' }}>
      <Text style={{ color: C.muted, fontSize: 13, fontFamily: F.body, letterSpacing: 0.5 }}>{label}</Text>
    </Pressable>
  );
}

function StatCard({
 value, label }) {
  const C = useTheme();
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20 }}>
      <Text style={{ color: C.white, fontSize: 28, fontFamily: F.headline }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 9, fontFamily: F.body, letterSpacing: 1, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

// ─── Screen: Home ─────────────────────────────────────────────────────────────
function HomeScreen({
 state, navigate, userName }) {
  const C = useTheme();
  const toggleTheme = useToggleTheme();
  const isDark = C.bg === DARK_THEME.bg;
  const [showTempControl, setShowTempControl] = useState(false);
  const [showCleaning, setShowCleaning]       = useState(false);
  const [cleanFreq, setCleanFreq]             = useState('daily');
  const [cleanHour, setCleanHour]             = useState(0);
  const [cleanMinute, setCleanMinute]         = useState(0);
  const [cleanEveryDays, setCleanEveryDays]   = useState(3);
  const [cleanDay, setCleanDay]               = useState('Mon');
  const [timeConfirmed, setTimeConfirmed]     = useState(false);
  const [cleanState, setCleanState]           = useState('idle'); // 'idle' | 'confirm1' | 'confirm2' | 'running' | 'done'
  const [cleanCountdown, setCleanCountdown]   = useState(0);
  const cleanTimerRef                         = useRef(null);

  const CLEAN_DURATION = 30; // seconds — replace with real cycle time
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const formatCleanTime = () => {
    const h = cleanHour.toString().padStart(2, '0');
    const m = cleanMinute.toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const cleanScheduleLabel = () => {
    if (cleanFreq === 'daily')   return `Daily at ${formatCleanTime()}`;
    if (cleanFreq === 'weekly')  return `Every ${cleanDay} at ${formatCleanTime()}`;
    return `Every ${cleanEveryDays} days at ${formatCleanTime()}`;
  };

  const startCleaning = () => {
    setCleanState('running');
    setCleanCountdown(CLEAN_DURATION);
    let secs = CLEAN_DURATION;
    cleanTimerRef.current = setInterval(() => {
      secs -= 1;
      setCleanCountdown(secs);
      if (secs <= 0) {
        clearInterval(cleanTimerRef.current);
        setCleanState('done');
      }
    }, 1000);
  };

  const handleCleanPress = () => {
    if (cleanState === 'idle')     { setCleanState('confirm1'); return; }
    if (cleanState === 'confirm1') { setCleanState('confirm2'); return; }
    if (cleanState === 'confirm2') { startCleaning(); return; }
    if (cleanState === 'done')     { setCleanState('confirm1'); return; }
  };

  const formatCountdown = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const cleanButtonLabel = () => {
    if (cleanState === 'idle')     return 'Clean now';
    if (cleanState === 'confirm1') return 'Are you sure?';
    if (cleanState === 'confirm2') return 'Tap again to confirm';
    if (cleanState === 'running')  return `Cleaning... ${formatCountdown(cleanCountdown)}`;
    if (cleanState === 'done')     return 'Clean again?';
  };

  const cleanButtonColor = () => {
    if (cleanState === 'idle')     return { border: C.border,  bg: 'transparent',               text: C.white };
    if (cleanState === 'confirm1') return { border: C.ochre,   bg: 'rgba(196,135,58,0.08)',      text: C.ochre };
    if (cleanState === 'confirm2') return { border: C.ochre,   bg: 'rgba(196,135,58,0.18)',      text: C.ochre };
    if (cleanState === 'running')  return { border: C.ochre,   bg: 'rgba(196,135,58,0.1)',       text: C.ochre };
    if (cleanState === 'done')     return { border: '#4CAF50', bg: 'rgba(76,175,80,0.1)',        text: '#4CAF50' };
  };

  const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state.ritualPoints);
  const progressPct = (pointsInLevel / pointsNeeded) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={state.isDark ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 28 }}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Logo ── */}
          <View style={{ alignItems: 'center', marginTop: 52, marginBottom: 22, height: 50 }}>
            <Image
              source={{ uri: C.bg === DARK_THEME.bg ? LOGO_URI : LOGO_URI_LIGHT }}
              style={{ width: 225, height: 50 }}
              resizeMode="contain"
            />
          </View>

          {/* ── Tagline ── */}
          <View style={{ alignItems: 'center', marginBottom: 44 }}>
            {userName ? (
              <Text style={{ fontFamily: F.headline, color: C.muted, fontSize: 13, letterSpacing: 3, textAlign: 'center' }}>
                WELCOME, {userName.toUpperCase()}.
              </Text>
            ) : (
              <Text style={{ fontFamily: F.headline, color: C.muted, fontSize: 13, letterSpacing: 3, textAlign: 'center', lineHeight: 22 }}>
                MODERN RITUALS.{'\n'}DESIGNED FOR LIFE.
              </Text>
            )}
          </View>

          {/* ── Your Walrus Dashboard ── */}
          <View style={{
            borderWidth: 1, borderColor: C.ochre,
            borderRadius: 16, padding: 20, marginBottom: 20,
            backgroundColor: 'rgba(196,135,58,0.04)',
          }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 20 }}>
              RITUAL RECORD
            </Text>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.totalSessions}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 1, marginTop: 4 }}>SESSIONS</Text>
              </View>
              <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.streak}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 1, marginTop: 4 }}>DAY STREAK</Text>
              </View>
              <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14 }}>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.totalMinutes}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 1, marginTop: 4 }}>MINUTES</Text>
              </View>
            </View>

            {/* Level + Points — both in ochre */}
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>LEVEL</Text>
                  <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28 }}>{level}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>TOTAL POINTS</Text>
                  <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28 }}>{state.ritualPoints}</Text>
                </View>
              </View>
              <View style={{ height: 2, backgroundColor: C.border, borderRadius: 1, overflow: 'hidden', marginBottom: 8 }}>
                <View style={{ height: '100%', width: `${progressPct}%`, backgroundColor: C.ochre }} />
              </View>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 1 }}>
                {getLevelName(level)} · {pointsNeeded - pointsInLevel} pts to Level {level + 1}
              </Text>
            </View>

            <Pressable onPress={() => navigate('progress')} style={{ alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, letterSpacing: 0.5 }}>View full progress →</Text>
            </Pressable>
          </View>

          {/* ── Actions ── */}
          <PrimaryButton label="Into the cold" onPress={() => navigate('session')} />
          <View style={{ height: 16 }} />
          <Pressable
            onPress={() => navigate('breathwork')}
            style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
          >
            <Text style={{ color: C.white, fontSize: 15, fontFamily: F.body, letterSpacing: 0.5 }}>Breathwork</Text>
          </Pressable>

          {/* ── Device card — below actions ── */}
          <View style={{
            borderWidth: 1,
            borderColor: state.deviceConnected ? C.ochre : C.border,
            borderRadius: 16, padding: 20,
            marginTop: 16, marginBottom: 8,
            backgroundColor: state.deviceConnected ? 'rgba(196,135,58,0.06)' : 'transparent',
          }}>
            {state.deviceConnected ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Walrus Ice Bath</Text>
                  <Pressable onPress={state.disconnectDevice}>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>HIDE</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>CURRENT</Text>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 26 }}>{state.currentTemp}°C</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowTempControl(!showTempControl)}
                    style={{
                      flex: 1, borderWidth: 1,
                      borderColor: showTempControl ? C.ochre : C.border,
                      borderRadius: 12, padding: 14, alignItems: 'center',
                      backgroundColor: showTempControl ? 'rgba(196,135,58,0.08)' : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>TARGET</Text>
                    <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 26 }}>{state.targetTemp}°C</Text>
                  </Pressable>
                  <Pressable
                    onPress={state.toggleLight}
                    style={{
                      flex: 1, borderWidth: 1,
                      borderColor: state.lightOn ? C.ochre : C.border,
                      borderRadius: 12, padding: 14, alignItems: 'center',
                      backgroundColor: state.lightOn ? 'rgba(196,135,58,0.08)' : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>LIGHT</Text>
                    <Text style={{ fontFamily: F.headline, color: state.lightOn ? C.ochre : C.white, fontSize: 26 }}>
                      {state.lightOn ? 'ON' : 'OFF'}
                    </Text>
                  </Pressable>
                </View>

                {showTempControl && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 24 }}>
                    <Pressable
                      onPress={() => state.setTargetTemp(Math.max(-3, state.targetTemp - 1))}
                      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: C.white, fontSize: 20 }}>−</Text>
                    </Pressable>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.targetTemp}°C</Text>
                    <Pressable
                      onPress={() => state.setTargetTemp(Math.min(12, state.targetTemp + 1))}
                      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: C.white, fontSize: 20 }}>+</Text>
                    </Pressable>
                  </View>
                )}

                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 3, textAlign: 'center' }}>ECO MODE ACTIVE</Text>

                {/* ── Cleaning row ── */}
                <Pressable
                  onPress={() => setShowCleaning(!showCleaning)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 14, paddingTop: 14,
                    borderTopWidth: 1, borderTopColor: C.border,
                  }}
                >
                  <View>
                    <Text style={{ fontFamily: F.body, color: C.white, fontSize: 12, letterSpacing: 0.5 }}>
                      Cleaning
                    </Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, marginTop: 2 }}>
                      {cleanScheduleLabel()}
                    </Text>
                  </View>
                  <Text style={{ color: C.muted, fontSize: 14 }}>{showCleaning ? '▲' : '▼'}</Text>
                </Pressable>

                {/* ── Cleaning panel ── */}
                {showCleaning && (
                  <View style={{ marginTop: 16, gap: 16 }}>

                    {/* Frequency selector */}
                    <View>
                      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>FREQUENCY</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {['daily', 'weekly', 'custom'].map(f => (
                          <Pressable
                            key={f}
                            onPress={() => setCleanFreq(f)}
                            style={{
                              flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                              borderWidth: 1,
                              borderColor: cleanFreq === f ? C.ochre : C.border,
                              backgroundColor: cleanFreq === f ? 'rgba(196,135,58,0.1)' : 'transparent',
                            }}
                          >
                            <Text style={{ fontFamily: F.body, color: cleanFreq === f ? C.ochre : C.muted, fontSize: 11, letterSpacing: 1 }}>
                              {f === 'custom' ? 'CUSTOM' : f.toUpperCase()}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    {/* Custom: every X days */}
                    {cleanFreq === 'custom' && (
                      <View>
                        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>EVERY X DAYS</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                          <Pressable
                            onPress={() => setCleanEveryDays(d => Math.max(2, d - 1))}
                            style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Text style={{ color: C.white, fontSize: 18 }}>−</Text>
                          </Pressable>
                          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28, minWidth: 40, textAlign: 'center' }}>{cleanEveryDays}</Text>
                          <Pressable
                            onPress={() => setCleanEveryDays(d => Math.min(30, d + 1))}
                            style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Text style={{ color: C.white, fontSize: 18 }}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {/* Weekly: day picker */}
                    {cleanFreq === 'weekly' && (
                      <View>
                        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>DAY</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {DAYS.map(d => (
                            <Pressable
                              key={d}
                              onPress={() => setCleanDay(d)}
                              style={{
                                flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                                borderWidth: 1,
                                borderColor: cleanDay === d ? C.ochre : C.border,
                                backgroundColor: cleanDay === d ? 'rgba(196,135,58,0.1)' : 'transparent',
                              }}
                            >
                              <Text style={{ fontFamily: F.body, color: cleanDay === d ? C.ochre : C.muted, fontSize: 9 }}>{d}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Time picker — column style */}
                    <View>
                      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 14 }}>TIME</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>

                        {/* Hours column */}
                        <View style={{ alignItems: 'center', width: 72 }}>
                          <Pressable
                            onPress={() => { setCleanHour(h => (h + 1) % 24); setTimeConfirmed(false); }}
                            style={{ padding: 10, width: '100%', alignItems: 'center' }}
                          >
                            <Text style={{ color: C.muted, fontSize: 18 }}>▲</Text>
                          </Pressable>
                          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
                            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32 }}>
                              {cleanHour.toString().padStart(2, '0')}
                            </Text>
                            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 2, marginTop: 4 }}>HH</Text>
                          </View>
                          <Pressable
                            onPress={() => { setCleanHour(h => (h - 1 + 24) % 24); setTimeConfirmed(false); }}
                            style={{ padding: 10, width: '100%', alignItems: 'center' }}
                          >
                            <Text style={{ color: C.muted, fontSize: 18 }}>▼</Text>
                          </Pressable>
                        </View>

                        <Text style={{ fontFamily: F.headline, color: C.muted, fontSize: 28, marginBottom: 8 }}>:</Text>

                        {/* Minutes column */}
                        <View style={{ alignItems: 'center', width: 72 }}>
                          <Pressable
                            onPress={() => { setCleanMinute(m => m === 0 ? 30 : 0); setTimeConfirmed(false); }}
                            style={{ padding: 10, width: '100%', alignItems: 'center' }}
                          >
                            <Text style={{ color: C.muted, fontSize: 18 }}>▲</Text>
                          </Pressable>
                          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
                            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32 }}>
                              {cleanMinute.toString().padStart(2, '0')}
                            </Text>
                            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 9, letterSpacing: 2, marginTop: 4 }}>MM</Text>
                          </View>
                          <Pressable
                            onPress={() => { setCleanMinute(m => m === 0 ? 30 : 0); setTimeConfirmed(false); }}
                            style={{ padding: 10, width: '100%', alignItems: 'center' }}
                          >
                            <Text style={{ color: C.muted, fontSize: 18 }}>▼</Text>
                          </Pressable>
                        </View>

                      </View>

                      {/* Confirm time button — neutral until tapped */}
                      <Pressable
                        onPress={() => setTimeConfirmed(true)}
                        style={{
                          marginTop: 14, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                          borderWidth: 1,
                          borderColor: timeConfirmed ? '#4CAF50' : C.ochre,
                          backgroundColor: timeConfirmed ? 'rgba(76,175,80,0.08)' : 'rgba(196,135,58,0.08)',
                          opacity: timeConfirmed ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ fontFamily: F.body, fontSize: 13, letterSpacing: 0.5, color: timeConfirmed ? '#4CAF50' : C.ochre }}>
                          {timeConfirmed ? 'Time confirmed ✓' : 'Confirm time'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Clean Now — with double confirm + countdown */}
                    <Pressable
                      onPress={cleanState === 'running' ? null : handleCleanPress}
                      style={{
                        borderWidth: 1,
                        borderColor: cleanButtonColor().border,
                        borderRadius: 12, paddingVertical: 14, alignItems: 'center',
                        backgroundColor: cleanButtonColor().bg,
                      }}
                    >
                      <Text style={{ fontFamily: F.body, color: cleanButtonColor().text, fontSize: 13, letterSpacing: 0.5 }}>
                        {cleanButtonLabel()}
                      </Text>
                      {cleanState === 'confirm2' && (
                        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, marginTop: 4 }}>
                          This will start an ozone clean cycle
                        </Text>
                      )}
                      {cleanState === 'done' && (
                        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, marginTop: 4 }}>
                          Last cleaned just now
                        </Text>
                      )}
                    </Pressable>

                    {/* Cancel double-confirm */}
                    {(cleanState === 'confirm1' || cleanState === 'confirm2') && (
                      <Pressable onPress={() => setCleanState('idle')} style={{ alignItems: 'center', paddingVertical: 6 }}>
                        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, letterSpacing: 0.5 }}>Cancel</Text>
                      </Pressable>
                    )}

                  </View>
                )}
              </View>
            ) : (
              <Pressable
                onPress={state.connectDevice}
                style={{ alignItems: 'center', paddingVertical: 4 }}
              >
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5, marginBottom: 6 }}>
                  Pair your Walrus
                </Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>
                  TAP TO CONNECT
                </Text>
              </Pressable>
            )}
          </View>

          {/* ── Theme switch ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32, marginBottom: 8 }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>DARK</Text>
            <Pressable
              onPress={toggleTheme}
              style={{
                width: 48, height: 26, borderRadius: 13,
                backgroundColor: isDark ? C.border : 'rgba(26,20,16,0.2)',
                borderWidth: 1, borderColor: C.border,
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: C.ochre,
                alignSelf: isDark ? 'flex-start' : 'flex-end',
              }} />
            </Pressable>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>LIGHT</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Screen: Breathwork ───────────────────────────────────────────────────────
function BreathworkScreen({
 navigate, onComplete, state }) {
  const C = useTheme();
  const [selected, setSelected]           = useState(null);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [phaseIndex, setPhaseIndex]       = useState(0);
  const [round, setRound]                 = useState(1);
  const [isComplete, setIsComplete]       = useState(false);
  const [countdown, setCountdown]         = useState(0);
  const [arcProgress, setArcProgress]     = useState(0);
  const [customRounds, setCustomRounds]   = useState(null);
  const [lastPointsEarned, setLastPointsEarned] = useState(0);
  const [wimPhase, setWimPhase]           = useState('breathing');
  const [breathCount, setBreathCount]     = useState(0);
  const [holdSeconds, setHoldSeconds]     = useState(0);
  const [recoveryCount, setRecoveryCount] = useState(15);
  const timerRef        = useRef(null);
  const holdRef         = useRef(null);
  const recoveryRef     = useRef(null);
  const customRoundsRef = useRef(null);

  const setCustomRoundsAndRef = (val) => {
    customRoundsRef.current = val;
    setCustomRounds(val);
  };

  const clearAllTimers = () => {
    clearInterval(timerRef.current);
    clearInterval(holdRef.current);
    clearInterval(recoveryRef.current);
  };

  // Fixed mode timer
  useEffect(() => {
    if (!isPlaying || !selected || selected.mode !== 'fixed') return;
    const phase = selected.phases[phaseIndex];
    const total = phase.duration;
    setCountdown(total);
    setArcProgress(0);
    let seconds = total;
    timerRef.current = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);
      setArcProgress((total - seconds) / total);
      if (seconds <= 0) {
        clearInterval(timerRef.current);
        setArcProgress(0);
        const nextPhase = phaseIndex + 1;
        if (nextPhase >= selected.phases.length) {
          const nextRound = round + 1;
          if (nextRound > (customRoundsRef.current ?? selected.rounds)) {
            setIsPlaying(false);
            setIsComplete(true);
            const _r = customRoundsRef.current ?? selected.rounds; const _pts = Math.round(_r * 10 * getStreakMultiplier(state?.streak ?? 0)); setLastPointsEarned(_pts); if (onComplete) onComplete(_r);
          } else { setRound(nextRound); setPhaseIndex(0); }
        } else { setPhaseIndex(nextPhase); }
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, phaseIndex, round, selected]);

  // Wim Hof: 30 guided breaths
  useEffect(() => {
    if (!isPlaying || selected?.mode !== 'wim' || wimPhase !== 'breathing') return;
    setBreathCount(0); setCountdown(2); setArcProgress(0);
    let phase = 'in'; let count = 0; let tick = 2;
    timerRef.current = setInterval(() => {
      tick -= 1;
      setCountdown(tick);
      setArcProgress((2 - tick) / 2);
      if (tick <= 0) {
        if (phase === 'in') { phase = 'out'; tick = 2; setPhaseIndex(1); setArcProgress(0); }
        else {
          phase = 'in'; tick = 2; count += 1;
          setBreathCount(count); setPhaseIndex(0); setArcProgress(0);
          if (count >= 30) { clearInterval(timerRef.current); setWimPhase('hold'); setHoldSeconds(0); }
        }
        setCountdown(tick);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, wimPhase, selected]);

  // Wim Hof: hold — count up, user taps to release
  useEffect(() => {
    if (!isPlaying || selected?.mode !== 'wim' || wimPhase !== 'hold') return;
    holdRef.current = setInterval(() => setHoldSeconds(s => s + 1), 1000);
    return () => clearInterval(holdRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, wimPhase, selected]);

  // Wim Hof: 15s recovery inhale hold
  useEffect(() => {
    if (!isPlaying || selected?.mode !== 'wim' || wimPhase !== 'recovery') return;
    setRecoveryCount(15); setArcProgress(0); let secs = 15;
    recoveryRef.current = setInterval(() => {
      secs -= 1; setRecoveryCount(secs);
      setArcProgress((15 - secs) / 15);
      if (secs <= 0) {
        clearInterval(recoveryRef.current);
        const nextRound = round + 1;
        if (nextRound > (customRoundsRef.current ?? selected.rounds)) {
          setIsPlaying(false); setIsComplete(true);
          const _r = customRoundsRef.current ?? selected.rounds; const _pts = Math.round(_r * 10 * getStreakMultiplier(state?.streak ?? 0)); setLastPointsEarned(_pts); if (onComplete) onComplete(_r);
        } else { setRound(nextRound); setWimPhase('breathing'); setBreathCount(0); }
      }
    }, 1000);
    return () => clearInterval(recoveryRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, wimPhase, selected]);

  const handleSkip = () => { clearAllTimers(); navigate('session'); };
  const handleBack = () => {
    clearAllTimers();
    if (selected) {
      setSelected(null); setIsPlaying(false); setWimPhase('breathing');
      setCustomRoundsAndRef(null);
    }
    else navigate('home');
  };

  // Completion
  if (isComplete && selected) {
    const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state?.ritualPoints ?? 0);
    const pointsToNext = pointsNeeded - pointsInLevel;

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 28 }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3 }}>
                BREATHWORK COMPLETE
              </Text>
            </View>

            <View style={{ marginBottom: 40, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 52, marginBottom: 14, textAlign: 'center' }}>
                Well done.
              </Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
                {selected.id === 'power'
                  ? 'Energized. Empowered. Ready for what\'s next.'
                  : 'Grounded and awake. Ready for what\'s next.'}
              </Text>
            </View>

            {/* Stats */}
            <View style={{ gap: 10, marginBottom: 20 }}>
              {/* Points earned */}
              <View style={{
                borderWidth: 1, borderColor: C.ochre, borderRadius: 16, padding: 20,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: 'rgba(196,135,58,0.07)',
              }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>POINTS EARNED</Text>
                <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28 }}>+{lastPointsEarned}</Text>
              </View>

              {/* Technique + rounds */}
              <View style={{
                borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <View>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>TECHNIQUE</Text>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{selected.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 6 }}>ROUNDS</Text>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{customRounds ?? selected.rounds}</Text>
                </View>
              </View>

              {/* Level + to next */}
              <View style={{
                borderWidth: 1, borderColor: C.ochre, borderRadius: 16, padding: 20,
                backgroundColor: 'rgba(196,135,58,0.06)',
              }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>YOUR LEVEL</Text>
                <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28, marginBottom: 4 }}>{level}</Text>
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13 }}>{getLevelName(level)}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 6 }}>
                  {pointsToNext} to Level {level + 1}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <PrimaryButton label="Into the cold" onPress={() => navigate('session')} />
            <View style={{ height: 16 }} />
            <Pressable
              onPress={() => { setIsComplete(false); setSelected(null); setRound(1); setPhaseIndex(0); setWimPhase('breathing'); setBreathCount(0); setHoldSeconds(0); setCustomRoundsAndRef(null); setLastPointsEarned(0); }}
              style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Do another</Text>
            </Pressable>
            <View style={{ height: 16 }} />
            <GhostButton label="Back to home" onPress={() => navigate('home')} />

          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Player
  if (selected) {
    const isWim = selected.mode === 'wim';
    const totalRounds = customRounds ?? selected.rounds;
    let circleTop = ''; let circleBottom = ''; let circleColor = C.white; let showHoldButton = false;
    if (!isPlaying) { circleTop = selected.name; circleBottom = 'TAP TO BEGIN'; }
    else if (isWim) {
      if (wimPhase === 'breathing') {
        circleTop = phaseIndex === 0 ? 'Inhale' : 'Exhale';
        circleBottom = `${breathCount} / 30`;
        circleColor = phaseIndex === 0 ? C.ochre : C.white;
      } else if (wimPhase === 'hold') {
        circleTop = `${holdSeconds}s`; circleBottom = 'HOLD';
        circleColor = C.ochre; showHoldButton = true;
      } else {
        circleTop = `${recoveryCount}`; circleBottom = 'RECOVER'; circleColor = C.white;
      }
    } else {
      const phase = selected.phases[phaseIndex];
      circleTop = `${countdown}`; circleBottom = phase?.label.toUpperCase() ?? '';
      circleColor = phase?.label === 'Inhale' ? C.ochre : C.white;
    }

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 16, marginBottom: 8 }}>
            <Pressable onPress={handleBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>BACK</Text>
            </Pressable>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>ROUND {round} / {totalRounds}</Text>
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>

            {/* Breathing pulse circle — main visual focus */}
            <Pressable
              onPress={() => {
                if (!isPlaying) {
                  setWimPhase('breathing'); setBreathCount(0); setHoldSeconds(0); setIsPlaying(true);
                } else if (isWim && wimPhase === 'hold') {
                  clearInterval(holdRef.current); setWimPhase('recovery');
                }
              }}
            >
              <BreathingCircle
                phase={isPlaying ? (isWim ? (wimPhase === 'hold' ? 'Hold' : wimPhase === 'recovery' ? 'Exhale' : (phaseIndex === 0 ? 'Inhale' : 'Exhale')) : (selected.phases[phaseIndex]?.label ?? 'Hold')) : 'Hold'}
                duration={isPlaying ? (isWim ? 2 : (selected.phases[phaseIndex]?.duration ?? 4)) : 4}
                isPlaying={isPlaying}
                circleColor={isPlaying ? circleColor : C.ochre}
              >
                <Text style={{
                  fontFamily: F.headline,
                  color: isPlaying ? circleColor : C.white,
                  fontSize: circleTop.length > 6 ? 26 : circleTop.length > 3 ? 34 : 48,
                  textAlign: 'center',
                  includeFontPadding: false,
                }}>
                  {circleTop}
                </Text>
                <Text style={{
                  fontFamily: F.body,
                  color: !isPlaying ? C.ochre : C.muted,
                  fontSize: 10, letterSpacing: 3, marginTop: 12, textAlign: 'center',
                }}>
                  {circleBottom}
                </Text>
                {/* Hint during hold phase */}
                {isWim && wimPhase === 'hold' && isPlaying && (
                  <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 9, letterSpacing: 2, marginTop: 8, textAlign: 'center' }}>
                    TAP TO RELEASE
                  </Text>
                )}
              </BreathingCircle>
            </Pressable>

            {/* Round selector — shown before start for all techniques */}
            {!isPlaying && (
              <View style={{ marginTop: 28, width: '100%' }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: 12 }}>
                  ROUNDS
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                  <Pressable
                    onPress={() => setCustomRoundsAndRef(Math.max(1, (customRounds ?? selected.rounds) - 1))}
                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: C.white, fontSize: 18 }}>−</Text>
                  </Pressable>
                  <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 32, minWidth: 40, textAlign: 'center' }}>
                    {customRounds ?? selected.rounds}
                  </Text>
                  <Pressable
                    onPress={() => setCustomRoundsAndRef(Math.min(20, (customRounds ?? selected.rounds) + 1))}
                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: C.white, fontSize: 18 }}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Power: show phase info before starting */}
            {isWim && !isPlaying && (
              <View style={{ marginTop: 28, width: '100%' }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { label: 'INHALE', value: '2s' },
                    { label: 'EXHALE', value: '2s' },
                    { label: 'HOLD',   value: 'max' },
                    { label: 'RECOVER', value: '15s' },
                  ].map((item) => (
                    <View key={item.label} style={{
                      flex: 1, borderWidth: 1, borderColor: C.border,
                      borderRadius: 10, padding: 10, alignItems: 'center',
                    }}>
                      <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 14 }}>{item.value}</Text>
                      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 8, letterSpacing: 1, marginTop: 4, textAlign: 'center' }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Wim Hof phase bar — well below circle */}
            {isWim && isPlaying && (
              <View style={{ width: '100%', marginTop: 56 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { key: 'breathing', label: '30 BREATHS', flex: 6 },
                    { key: 'hold',      label: 'HOLD',       flex: 2 },
                    { key: 'recovery',  label: 'RECOVER',    flex: 2 },
                  ].map(p => (
                    <View key={p.key} style={{ flex: p.flex }}>
                      <View style={{ height: 3, borderRadius: 2, backgroundColor: wimPhase === p.key ? C.ochre : C.border, marginBottom: 6 }} />
                      <Text style={{ fontFamily: F.body, color: wimPhase === p.key ? C.ochre : C.muted, fontSize: 9, letterSpacing: 1 }}>{p.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Fixed mode rhythm bar — well below circle */}
            {!isWim && selected.phases.length > 0 && (
              <View style={{ width: 220, marginTop: 56 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  {selected.phases.map((p, i) => (
                    <Text key={i} style={{ fontFamily: F.body, color: isPlaying && i === phaseIndex ? C.ochre : C.muted, fontSize: 9, letterSpacing: 1 }}>
                      {p.label.toUpperCase()}
                    </Text>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {selected.phases.map((p, i) => {
                    const total = selected.phases.reduce((a, ph) => a + ph.duration, 0);
                    return <View key={i} style={{ flex: p.duration / total, height: 3, borderRadius: 2, backgroundColor: isPlaying && i === phaseIndex ? C.ochre : C.border }} />;
                  })}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  {selected.phases.map((p, i) => (
                    <Text key={i} style={{ fontFamily: F.body, color: C.muted, fontSize: 9 }}>{p.duration}s</Text>
                  ))}
                </View>
              </View>
            )}

          </View>

          <View style={{ paddingHorizontal: 28, paddingBottom: 40, gap: 12 }}>

            {/* Pause — only while actively playing breathing phase */}
            {isPlaying && (wimPhase === 'breathing' || selected.mode === 'fixed') && (
              <Pressable
                onPress={() => { clearAllTimers(); setIsPlaying(false); }}
                style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Pause</Text>
              </Pressable>
            )}

            {/* Resume — when paused mid-session */}
            {!isPlaying && (breathCount > 0 || (selected.mode === 'fixed' && countdown > 0 && countdown < (selected.phases[phaseIndex]?.duration ?? 0))) && (
              <PrimaryButton label="Resume" onPress={() => setIsPlaying(true)} />
            )}

            {/* Reset — start from scratch */}
            {!isPlaying && (breathCount > 0 || round > 1 || countdown > 0) && (
              <Pressable
                onPress={() => { clearAllTimers(); setIsPlaying(false); setRound(1); setPhaseIndex(0); setWimPhase('breathing'); setBreathCount(0); setHoldSeconds(0); setCountdown(0); setArcProgress(0); }}
                style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, letterSpacing: 0.5 }}>Reset</Text>
              </Pressable>
            )}

            <GhostButton label="Skip · into the cold" onPress={handleSkip} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Picker
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 40 }}>
          <Pressable onPress={() => navigate('home')} style={{ paddingTop: 16, marginBottom: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>HOME</Text>
          </Pressable>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 40, marginBottom: 10 }}>
            Breathwork
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 36 }}>
            A few minutes of intentional breath.{'\n'}Before the cold, after it, or simply on its own.
          </Text>

          {TECHNIQUES.map((t) => {
            const isWim = t.mode === 'wim';
            const total = isWim ? 0 : t.phases.reduce((a, p) => a + p.duration, 0);
            return (
              <Pressable
                key={t.id}
                onPress={() => { setSelected(t); setPhaseIndex(0); setRound(1); setIsComplete(false); setCountdown(0); setWimPhase('breathing'); setBreathCount(0); setHoldSeconds(0); setCustomRoundsAndRef(null); }}
                style={({ pressed }) => ({
                  borderWidth: 1, borderColor: pressed ? C.ochre : C.border,
                  borderRadius: 16, padding: 22, marginBottom: 12,
                  backgroundColor: pressed ? 'rgba(196,135,58,0.06)' : 'transparent',
                })}
              >
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22, marginBottom: 4 }}>{t.name}</Text>
                <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>{t.subtitle}</Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 }}>{t.description}</Text>

                {isWim ? (
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 1 }}>
                    {t.rounds} rounds · 30 breaths + hold
                  </Text>
                ) : (
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 1 }}>
                    {t.rounds} rounds · {total}s per cycle
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}


// ─── Screen: Session ──────────────────────────────────────────────────────────
function SessionScreen({
 navigate, onComplete }) {
  const C = useTheme();
  const [isRunning, setIsRunning]   = useState(false);
  const [elapsed, setElapsed]       = useState(0);
  const [copyIndex, setCopyIndex]   = useState(0);
  const timerRef  = useRef(null);
  const copyRef   = useRef(null);

  // Rotating motivational copy while running — changes every 30s
  const RUNNING_COPY = [
    'Breathe.',
    'You are stronger than you think.',
    'Sit with it.',
  ];

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      copyRef.current  = setInterval(() => setCopyIndex(i => (i + 1) % RUNNING_COPY.length), 30000);
    } else {
      clearInterval(timerRef.current);
      clearInterval(copyRef.current);
    }
    return () => {
      clearInterval(timerRef.current);
      clearInterval(copyRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  const handleFinish = () => {
    clearInterval(timerRef.current);
    clearInterval(copyRef.current);
    setIsRunning(false);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    onComplete(elapsed);
    navigate('completion', { minutes, seconds: elapsed });
  };

  const handleReset = () => {
    clearInterval(timerRef.current);
    clearInterval(copyRef.current);
    setIsRunning(false);
    setElapsed(0);
    setCopyIndex(0);
  };

  const copy = !isRunning && elapsed === 0
    ? 'The cold asks nothing of you\nbut your presence.'
    : isRunning
    ? RUNNING_COPY[copyIndex]
    : 'Take your time.\nThe cold will wait.';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header with back button */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 16 }}>
          <Pressable
            onPress={() => { clearInterval(timerRef.current); clearInterval(copyRef.current); navigate('home'); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>HOME</Text>
          </Pressable>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3 }}>COLD SESSION</Text>
        </View>

        {/* Circle + copy */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Pressable
            onPress={() => {
              if (!isRunning) setIsRunning(true);
            }}
          >
            <WaterCircle isActive={isRunning} elapsed={elapsed} maxSeconds={180}>
              <Text style={{
                fontFamily: F.headline, color: C.white,
                fontSize: elapsed >= 3600 ? 32 : 48,
                textAlign: 'center', includeFontPadding: false,
              }}>
                {formatTime(elapsed)}
              </Text>
              <Text style={{
                fontFamily: F.body,
                color: isRunning ? C.muted : elapsed > 0 ? C.muted : C.ochre,
                fontSize: 10, letterSpacing: 3, marginTop: 12, textAlign: 'center',
              }}>
                {isRunning ? 'IN THE COLD' : elapsed > 0 ? 'PAUSED' : 'TAP TO BEGIN'}
              </Text>
            </WaterCircle>
          </Pressable>

          {/* Motivational copy */}
          <Text style={{
            fontFamily: F.body, color: C.muted,
            fontSize: 15, textAlign: 'center',
            lineHeight: 24, marginTop: 48,
            paddingHorizontal: 32,
          }}>
            {isRunning ? 'Breathe & Sit with the Cold.' : copy}
          </Text>
        </View>

        {/* Controls — fixed layout, no jumping */}
        <View style={{ paddingHorizontal: 28, paddingBottom: 40 }}>

          {/* Primary button — always same height, switches label */}
          <PrimaryButton
            label={elapsed === 0 && !isRunning ? 'Into the cold' : 'Finish session'}
            onPress={elapsed === 0 && !isRunning ? () => setIsRunning(true) : handleFinish}
          />

          {/* Secondary row — always 52px tall so layout never shifts */}
          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
            {isRunning && (
              <Pressable
                onPress={() => setIsRunning(false)}
                style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Pause</Text>
              </Pressable>
            )}
            {!isRunning && elapsed > 0 && (
              <>
                <Pressable
                  onPress={() => setIsRunning(true)}
                  style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13, letterSpacing: 0.5 }}>Resume</Text>
                </Pressable>
                <Pressable
                  onPress={handleReset}
                  style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, letterSpacing: 0.5 }}>Reset</Text>
                </Pressable>
              </>
            )}
          </View>

        </View>

      </SafeAreaView>
    </View>
  );
}

// ─── Screen: Completion ───────────────────────────────────────────────────────
function CompletionScreen({
 state, minutes, seconds, navigate }) {
  const C = useTheme();
  const actualSeconds = seconds ?? minutes * 60;
  const multiplier    = getStreakMultiplier(state.streak);
  const pointsEarned  = state.lastSessionPoints;
  const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state.ritualPoints);

  // Format time display — show seconds if under 1 min
  const timeDisplay = actualSeconds < 60
    ? `${actualSeconds}s`
    : actualSeconds < 3600
    ? `${Math.floor(actualSeconds / 60)} min ${actualSeconds % 60 > 0 ? `${actualSeconds % 60}s` : ''}`
    : `${Math.floor(actualSeconds / 3600)}h ${Math.floor((actualSeconds % 3600) / 60)} min`;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', marginTop: 60, marginBottom: 28 }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3 }}>SESSION COMPLETE</Text>
          </View>

          <View style={{ marginBottom: 48, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 52, marginBottom: 14, textAlign: 'center' }}>Well done.</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              Stillness is the work.
            </Text>
          </View>

          {/* Stats */}
          <View style={{ gap: 10, marginBottom: 32 }}>
            {[
              { label: 'POINTS EARNED', value: `+${pointsEarned}`, sub: multiplier > 1 ? `${multiplier}× streak bonus` : null, highlight: true },
              { label: 'TIME IN COLD',  value: timeDisplay, sub: null, highlight: false },
              { label: 'STREAK',        value: `${state.streak} ${state.streak === 1 ? 'day' : 'days'}`, sub: null, highlight: state.streak >= 2 },
            ].map((row) => (
              <View key={row.label} style={{
                borderWidth: 1,
                borderColor: row.highlight ? C.ochre : C.border,
                borderRadius: 16, padding: 20,
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: row.highlight ? 'rgba(196,135,58,0.07)' : 'transparent',
              }}>
                <View>
                  <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>{row.label}</Text>
                  {row.sub && (
                    <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 10, marginTop: 2 }}>{row.sub}</Text>
                  )}
                </View>
                <Text style={{ fontFamily: F.headline, color: row.highlight ? C.ochre : C.white, fontSize: 28 }}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Level card */}
          <View style={{
            borderWidth: 1, borderColor: C.ochre, borderRadius: 16,
            padding: 20, marginBottom: 32,
            backgroundColor: 'rgba(196,135,58,0.06)',
          }}>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>YOUR LEVEL</Text>
            <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28, marginBottom: 4 }}>{level}</Text>
            <Text style={{ fontFamily: F.body, color: C.white, fontSize: 13 }}>{getLevelName(level)}</Text>
            <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, marginTop: 6 }}>
              {state.ritualPoints.toLocaleString()} total
            </Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 4 }}>
              {pointsNeeded - pointsInLevel} to Level {level + 1}
            </Text>
          </View>

          {/* Actions */}
          <PrimaryButton label="View progress" onPress={() => navigate('progress')} />
          <View style={{ height: 12 }} />
          <GhostButton label="Back to home" onPress={() => navigate('home')} />

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Screen: Progress ─────────────────────────────────────────────────────────
function ProgressScreen({
 state, navigate }) {
  const C = useTheme();
  const { level, pointsInLevel, pointsNeeded } = getLevelFromPoints(state.ritualPoints);
  const progressPct  = (pointsInLevel / pointsNeeded) * 100;
  const pointsToNext = pointsNeeded - pointsInLevel;
  const totalHours   = Math.floor(state.totalMinutes / 60);
  const remainMins   = state.totalMinutes % 60;
  const multiplier   = getStreakMultiplier(state.streak);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

          <Pressable onPress={() => navigate('home')} style={{ paddingTop: 16, marginBottom: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>HOME</Text>
          </Pressable>

          {/* Title */}
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>
            RITUAL RECORD
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 40, marginBottom: 32 }}>
            Your Progress
          </Text>

          {/* Level card */}
          <View style={{
            borderWidth: 1, borderColor: C.ochre, borderRadius: 16,
            padding: 20, marginBottom: 12,
            backgroundColor: 'rgba(196,135,58,0.06)',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 3, marginBottom: 4 }}>LEVEL</Text>
                <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 28 }}>{level}</Text>
                <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 12, marginTop: 4 }}>{getLevelName(level)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>TOTAL POINTS</Text>
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 28 }}>{state.ritualPoints}</Text>
              </View>
            </View>

            <View style={{ height: 2, backgroundColor: C.border, borderRadius: 1, overflow: 'hidden', marginBottom: 8, marginTop: 16 }}>
              <View style={{ height: '100%', width: `${progressPct}%`, backgroundColor: C.ochre }} />
            </View>

            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 10, letterSpacing: 1 }}>
              {pointsToNext} pts to Level {level + 1} · {getLevelName(level + 1)}
            </Text>
          </View>

          {/* Streak multiplier info */}
          {state.streak > 0 && (
            <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 2 }}>CURRENT MULTIPLIER</Text>
              <Text style={{ fontFamily: F.headline, color: C.ochre, fontSize: 22 }}>{multiplier}×</Text>
            </View>
          )}

          {/* Stats grid */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <StatCard value={state.totalSessions} label="SESSIONS" />
            <StatCard value={state.streak} label="DAY STREAK" />
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
            <StatCard
              value={totalHours > 0 ? `${totalHours}h ${remainMins} min` : `${state.totalMinutes} min`}
              label="IN THE COLD"
            />
            <StatCard value={state.completedBreathworks} label="BREATHWORK" />
          </View>

          {state.totalSessions === 0 && (
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, lineHeight: 22, marginBottom: 28 }}>
              Complete your first session to begin your record.
            </Text>
          )}

          <PrimaryButton label="Into the cold" onPress={() => navigate('session')} />
          <View style={{ height: 12 }} />
          <Pressable
            onPress={() => navigate('breathwork')}
            style={{ borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 18, alignItems: 'center' }}
          >
            <Text style={{ color: C.white, fontSize: 15, fontFamily: F.body, letterSpacing: 0.5 }}>Breathwork</Text>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
// ─── Onboarding shared components ────────────────────────────────────────────
function ProgressDots({
 total, current }) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 48 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{
          width: i === current ? 20 : 6, height: 6, borderRadius: 3,
          backgroundColor: i === current ? C.ochre : 'rgba(245,236,215,0.2)',
        }} />
      ))}
    </View>
  );
}

// ─── Screen: Splash ───────────────────────────────────────────────────────────
function SplashScreen({
 navigate }) {
  const C = useTheme();
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Prefetch logo immediately so it's cached before home screen appears
    Image.prefetch(LOGO_URI);

    Animated.sequence([
      // Logo fades in
      Animated.timing(logoOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
      // Short pause, then tagline fades in
      Animated.delay(400),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 1600, useNativeDriver: true }),
      // Hold a moment
      Animated.delay(1800),
      // Whole screen fades out
      Animated.timing(screenOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start(() => navigate('onboard-welcome'));

    return () => {
      logoOpacity.stopAnimation();
      taglineOpacity.stopAnimation();
      screenOpacity.stopAnimation();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View style={{ flex: 1, opacity: screenOpacity, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Image
          source={{ uri: C.bg === DARK_THEME.bg ? LOGO_URI : LOGO_URI_LIGHT }}
          style={{ width: 280, height: 62, opacity: logoOpacity }}
          resizeMode="contain"
        />
        <Animated.Text style={{
          fontFamily: F.headline, color: C.muted, fontSize: 12,
          letterSpacing: 3, marginTop: 24, textAlign: 'center',
          opacity: taglineOpacity,
        }}>
          MODERN RITUALS.{'\n'}DESIGNED FOR LIFE.
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

// ─── Screen: Onboarding Welcome ───────────────────────────────────────────────
function OnboardWelcomeScreen({
 navigate }) {
  const C = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Animated.View style={{ flex: 1, opacity }}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* Logo + headline centred in upper half */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
            <Image
              source={{ uri: C.bg === DARK_THEME.bg ? LOGO_URI : LOGO_URI_LIGHT }}
              style={{ width: 280, height: 62, marginBottom: 48 }}
              resizeMode="contain"
            />
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, lineHeight: 42, marginBottom: 16, textAlign: 'center' }}>
              The ritual{'\n'}starts here.
            </Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              Cold. Breath. Presence.{'\n'}Every day.
            </Text>
          </View>

          {/* Auth buttons pinned to bottom */}
          <View style={{ paddingHorizontal: 40, paddingBottom: 48, gap: 12 }}>
            <Pressable
              onPress={() => navigate('onboard-name')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: C.border, borderRadius: 14,
                paddingVertical: 18, gap: 10,
                backgroundColor: pressed ? 'rgba(245,236,215,0.05)' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 16 }}>G</Text>
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5 }}>Continue with Google</Text>
            </Pressable>

            <Pressable
              onPress={() => navigate('onboard-name')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: C.border, borderRadius: 14,
                paddingVertical: 18, gap: 10,
                backgroundColor: pressed ? 'rgba(245,236,215,0.05)' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 16, color: C.white }}></Text>
              <Text style={{ fontFamily: F.body, color: C.white, fontSize: 15, letterSpacing: 0.5 }}>Continue with Apple</Text>
            </Pressable>

            <Pressable onPress={() => navigate('onboard-email')} style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, letterSpacing: 0.5 }}>Continue with email</Text>
            </Pressable>
          </View>

        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

// ─── Screen: Onboarding Email ─────────────────────────────────────────────────
function OnboardEmailScreen({
 navigate }) {
  const C = useTheme();
  const [email, setEmail] = React.useState('');
  const isValid = email.includes('@') && email.includes('.');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <Pressable onPress={() => navigate('onboard-welcome')} style={{ paddingHorizontal: 40, paddingTop: 24, marginBottom: 48 }}>
          <Text style={{ color: C.muted, fontSize: 20 }}>←</Text>
        </Pressable>

        <View style={{ flex: 1, paddingHorizontal: 40 }}>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 48 }}>
            Your email.
          </Text>

          <View style={{ borderBottomWidth: 1, borderBottomColor: isValid ? C.ochre : C.border, paddingBottom: 12, marginBottom: 48 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="hello@yourname.com"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
              style={{ fontFamily: F.body, color: C.white, fontSize: 18, padding: 0 }}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingBottom: 48 }}>
          <PrimaryButton
            label="Continue"
            onPress={() => { if (isValid) navigate('onboard-name'); }}
          />
          {!isValid && email.length > 0 && (
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              Please enter a valid email address.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Screen: Onboarding Name ──────────────────────────────────────────────────
function OnboardNameScreen({
 navigate, onSetName }) {
  const C = useTheme();
  const [name, setName] = React.useState('');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <ProgressDots total={4} current={0} />
        </View>

        <View style={{ flex: 1, paddingHorizontal: 40, justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
            STEP 1 OF 4
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 48 }}>
            What should{'\n'}we call you?
          </Text>

          <View style={{ borderBottomWidth: 1, borderBottomColor: name.length > 0 ? C.ochre : C.border, paddingBottom: 12, marginBottom: 48 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor={C.muted}
              autoFocus
              style={{ fontFamily: F.headline, color: C.white, fontSize: 28, padding: 0 }}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingBottom: 48 }}>
          <PrimaryButton
            label="Continue"
            onPress={() => { if (name.trim()) { onSetName(name.trim()); navigate('onboard-why'); } }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Screen: Onboarding Why ───────────────────────────────────────────────────
function OnboardWhyScreen({
 navigate, userName }) {
  const C = useTheme();
  const [selected, setSelected] = React.useState([]);

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const options = [
    { id: 'recovery',    label: 'Recovery',     sub: 'Muscle recovery and inflammation' },
    { id: 'performance', label: 'Performance',  sub: 'Push further, adapt faster' },
    { id: 'mental',      label: 'Mental health', sub: 'Clarity, calm and resilience' },
    { id: 'curiosity',   label: 'Curiosity',    sub: 'Just getting started' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <ProgressDots total={4} current={1} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 40, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
            STEP 2 OF 4
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 8 }}>
            Why the cold,{'\n'}{userName}?
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, marginBottom: 36 }}>
            Choose all that apply.
          </Text>

          <View style={{ gap: 12, marginBottom: 24 }}>
            {options.map(opt => {
              const isSelected = selected.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => toggle(opt.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: isSelected ? C.ochre : C.border,
                    borderRadius: 14, padding: 20,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: isSelected ? 'rgba(196,135,58,0.08)' : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 18, marginBottom: 4 }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{opt.sub}</Text>
                  </View>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: 1,
                    borderColor: isSelected ? C.ochre : C.border,
                    backgroundColor: isSelected ? C.ochre : 'transparent',
                    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
                  }}>
                    {isSelected && <Text style={{ color: C.bg, fontSize: 13, lineHeight: 16 }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 12, paddingBottom: 24 }}>
            <PrimaryButton
              label="Continue"
              onPress={() => { if (selected.length > 0) navigate('onboard-experience'); }}
            />
            <GhostButton label="Skip" onPress={() => navigate('onboard-experience')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Screen: Onboarding Experience ───────────────────────────────────────────
function OnboardExperienceScreen({
 navigate }) {
  const C = useTheme();
  const [selected, setSelected] = React.useState(null);

  const options = [
    { id: 'first',    label: 'First timer',       sub: 'Never done this before' },
    { id: 'some',     label: 'Some experience',   sub: 'Done it a few times' },
    { id: 'regular',  label: 'Regular plunger',   sub: 'Part of my routine' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <ProgressDots total={4} current={2} />
        </View>

        <View style={{ flex: 1, paddingHorizontal: 40 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
            STEP 3 OF 4
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 8 }}>
            How familiar{'\n'}are you?
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 14, marginBottom: 36 }}>
            Be honest. The cold always knows.
          </Text>

          <View style={{ gap: 12 }}>
            {options.map(opt => (
              <Pressable
                key={opt.id}
                onPress={() => setSelected(opt.id)}
                style={{
                  borderWidth: 1,
                  borderColor: selected === opt.id ? C.ochre : C.border,
                  borderRadius: 14, padding: 20,
                  backgroundColor: selected === opt.id ? 'rgba(196,135,58,0.08)' : 'transparent',
                }}
              >
                <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 18, marginBottom: 4 }}>
                  {opt.label}
                </Text>
                <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>{opt.sub}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingBottom: 48, gap: 12 }}>
          <PrimaryButton
            label="Continue"
            onPress={() => { if (selected) navigate('onboard-device'); }}
          />
          <GhostButton label="Skip" onPress={() => navigate('onboard-device')} />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Screen: Onboarding Device ────────────────────────────────────────────────
function OnboardDeviceScreen({
 navigate, userName }) {
  const C = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 40, paddingTop: 24 }}>
          <ProgressDots total={4} current={3} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
            STEP 4 OF 4
          </Text>
          <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 34, marginBottom: 12 }}>
            Pair your{'\n'}Walrus.
          </Text>
          <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 24, marginBottom: 48 }}>
            Set your temperature from anywhere. By the time you arrive, your Ice Bath is ready.
          </Text>

          <View style={{
            borderWidth: 1, borderColor: C.border,
            borderRadius: 16, padding: 28,
            alignItems: 'center', marginBottom: 12,
          }}>
            <Text style={{ fontFamily: F.headline, color: C.white, fontSize: 22, marginBottom: 8 }}>
              Walrus Ice Bath
            </Text>
            <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Make sure your Ice Bath and phone are connected to the same Wi-Fi network.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 40, paddingBottom: 48, gap: 12 }}>
          <PrimaryButton label="Pair now" onPress={() => navigate('home')} />
          <GhostButton label="Skip for now" onPress={() => navigate('home')} />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]                 = useState('splash');
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [userName, setUserName]             = useState('');
  const [fontsLoaded, setFontsLoaded]       = useState(false);
  const [isDark, setIsDark]                 = useState(true);
  const toggleTheme = React.useCallback(() => setIsDark(d => !d), []);
  const state = useAppState();
  const theme = isDark ? DARK_THEME : LIGHT_THEME;

  useEffect(() => {
    Promise.all([
      Font.loadAsync(FONTS),
      Image.prefetch(LOGO_URI),
      Image.prefetch(LOGO_URI_LIGHT),
    ]).then(() => setFontsLoaded(true));
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_THEME.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: DARK_THEME.muted, fontSize: 11, letterSpacing: 3 }}>LOADING...</Text>
      </View>
    );
  }

  const navigate = (to, params = {}) => {
    if (params.minutes) setSessionMinutes(params.minutes);
    if (params.seconds !== undefined) setSessionSeconds(params.seconds);
    setScreen(to);
  };

  const handleSessionComplete = (seconds) => {
    state.completeSession(seconds);
  };

  let currentScreen;
  switch (screen) {
    case 'splash':            currentScreen = <SplashScreen navigate={navigate} />; break;
    case 'onboard-welcome':   currentScreen = <OnboardWelcomeScreen navigate={navigate} />; break;
    case 'onboard-email':     currentScreen = <OnboardEmailScreen navigate={navigate} />; break;
    case 'onboard-name':      currentScreen = <OnboardNameScreen navigate={navigate} onSetName={setUserName} />; break;
    case 'onboard-why':       currentScreen = <OnboardWhyScreen navigate={navigate} userName={userName} />; break;
    case 'onboard-experience':currentScreen = <OnboardExperienceScreen navigate={navigate} />; break;
    case 'onboard-device':    currentScreen = <OnboardDeviceScreen navigate={navigate} userName={userName} />; break;
    case 'breathwork':        currentScreen = <BreathworkScreen navigate={navigate} onComplete={state.completeBreathwork} state={state} />; break;
    case 'session':           currentScreen = <SessionScreen navigate={navigate} onComplete={handleSessionComplete} />; break;
    case 'completion':        currentScreen = <CompletionScreen state={state} minutes={sessionMinutes} seconds={sessionSeconds} navigate={navigate} />; break;
    case 'progress':          currentScreen = <ProgressScreen state={state} navigate={navigate} />; break;
    default:                  currentScreen = <HomeScreen state={state} navigate={navigate} userName={userName} />;
  }

  return (
    <ThemeToggleContext.Provider value={toggleTheme}>
      <ThemeContext.Provider value={theme}>
        {currentScreen}
      </ThemeContext.Provider>
    </ThemeToggleContext.Provider>
  );
}