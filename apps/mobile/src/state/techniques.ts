// Breathwork techniques (port từ replit_generate/App.js)

export type BreathPhase = { label: string; duration: number };

export type Technique = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  phases: BreathPhase[];
  rounds: number;
  mode: 'fixed' | 'wim';
};

export const TECHNIQUES: Technique[] = [
  {
    id: 'box',
    name: 'Focus',
    subtitle: 'Calm your mind',
    description:
      'Four counts in. Four counts held. Four counts out. A rhythm that returns you to yourself.',
    phases: [
      { label: 'Inhale', duration: 4 },
      { label: 'Hold', duration: 4 },
      { label: 'Exhale', duration: 4 },
      { label: 'Hold', duration: 4 },
    ],
    rounds: 6,
    mode: 'fixed',
  },
  {
    id: 'power',
    name: 'Power',
    subtitle: 'Charge your body',
    description:
      'Thirty deep breaths. Then silence. Hold as long as you can — this is where the work begins.',
    phases: [],
    rounds: 3,
    mode: 'wim',
  },
  {
    id: 'calm',
    name: 'Recovery',
    subtitle: 'Settle your nervous system',
    description:
      'Breathe in slowly. Let the exhale carry twice as long. Step into the cold already at ease.',
    phases: [
      { label: 'Inhale', duration: 4 },
      { label: 'Exhale', duration: 8 },
    ],
    rounds: 8,
    mode: 'fixed',
  },
];
