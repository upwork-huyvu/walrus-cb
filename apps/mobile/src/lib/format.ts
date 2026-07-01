export const LOGO_URI =
  'https://www.dropbox.com/scl/fi/dx2z893cur4m811lhyjj6/Composite-Mark-Ochre.png?rlkey=puv93vhjwd0dgt01xsfxnk2or&dl=1';
export const LOGO_URI_LIGHT =
  'https://www.dropbox.com/scl/fi/2rr7k4dflx2chui0slukd/Composite-Mark-Black-Cedar.png?rlkey=hxmzpj5khud1szoew4yjm4kqr&dl=1';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatTime(s: number): string {
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}
