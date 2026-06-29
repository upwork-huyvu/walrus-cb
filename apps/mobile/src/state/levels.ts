// Level system + streak multiplier (port từ replit_generate/App.js)

export const LEVEL_NAMES: string[] = [
  '', // index 0 unused
  'Still Dressed',
  'Hesitant Dipper',
  'Toe Tester',
  'Reluctant Plunger',
  'Brave Beginner',
  'Chill Seeker',
  'Cold Curious',
  'Shiver Starter',
  'Ice Initiate',
  'Frosty Newcomer',
  'Cold Convert',
  'Plunge Regular',
  'Chill Enthusiast',
  'Ice Apprentice',
  'Cold Committed',
  'Frost Follower',
  'Icy Devotee',
  'Cold Blooded',
  'Polar Pupil',
  'Arctic Aspirant',
  'Cold Tactician',
  'Ice Veteran',
  'Frost Faithful',
  'Plunge Pro',
  'Chill Master',
  'Cold Operator',
  'Arctic Adept',
  'Ice Strategist',
  'Frost Commander',
  'Cold Authority',
  'Polar Practitioner',
  'Ice Specialist',
  'Arctic Expert',
  'Frost Veteran',
  'Cold Sage',
  'Plunge Scholar',
  'Ice Philosopher',
  'Frost Thinker',
  'Arctic Sage',
  'Cold Luminary',
  'Polar Intellectual',
  'Ice Elder',
  'Frost Keeper',
  'Arctic Steward',
  'Cold Guardian',
  'Polar Sentinel',
  'Ice Warden',
  'Frost Champion',
  'Arctic Defender',
  'Frost Warrior',
  'Cold Crusader',
  'Ice Knight',
  'Polar Paladin',
  'Arctic Avenger',
  'Frost Fighter',
  'Cold Gladiator',
  'Ice Centurion',
  'Polar Protector',
  'Arctic Titan',
  'Cold Colossus',
  'Ice Overlord',
  'Frost Sovereign',
  'Polar Ruler',
  'Arctic Monarch',
  'Cold Emperor',
  'Ice Regent',
  'Frost Lord',
  'Polar Warlord',
  'Arctic Conqueror',
  'Cold Vanquisher',
  'Ice Dominator',
  'Frost Subjugator',
  'Polar Supremacy',
  'Arctic Pinnacle',
  'Cold Summit',
  'Ice Apex',
  'Frost Zenith',
  'Polar Peak',
  'Arctic Crest',
  'Cold Ascendant',
  'Ice Transcendent',
  'Frost Enlightened',
  'Polar Illuminated',
  'Arctic Awakened',
  'Cold Evolved',
  'Ice Transformed',
  'Frost Metamorphosed',
  'Polar Transfigured',
  'Arctic Elevated',
  'Cold Exalted',
  'Ice Glorified',
  'Frost Hallowed',
  'Polar Revered',
  'Arctic Venerated',
  'Cold Immortal',
  'Ice Eternal',
  'Frost Infinite',
  'Polar Boundless',
  'Arctic Limitless',
  'Arctic Regular',
];

export function getLevelName(level: number): string {
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

// Level 1→2 = 300 pts, mỗi level sau cần ~1.4x
export function pointsForLevel(level: number): number {
  return Math.round(300 * Math.pow(1.4, level - 1));
}

export function getLevelFromPoints(totalPoints: number): {
  level: number;
  pointsInLevel: number;
  pointsNeeded: number;
} {
  let level = 1;
  let remaining = totalPoints;
  while (remaining >= pointsForLevel(level)) {
    remaining -= pointsForLevel(level);
    level++;
  }
  return { level, pointsInLevel: remaining, pointsNeeded: pointsForLevel(level) };
}

export function getStreakMultiplier(streak: number): number {
  if (streak >= 14) return 3.0;
  if (streak >= 7) return 2.5;
  if (streak >= 4) return 2.0;
  if (streak >= 2) return 1.5;
  return 1.0;
}
