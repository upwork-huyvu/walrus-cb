'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import OnlineChip from './OnlineChip';
import { sendDeviceCommand, type ControlInput } from '@/app/devices/[id]/actions';

export type DeviceDetail = {
  id: string;
  name: string;
  online: boolean;
  currentTemp: number | null;
  targetTemp: number | null;
  tempRange: { min: number; max: number; step: number; unit: string } | null;
  power: boolean | null;
  light: boolean | null;
  purify: boolean | null;
  fault: number | null;
};

type Pending = { label: string; input: ControlInput };

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

export default function DeviceControlPanel({ device }: { device: DeviceDetail }) {
  const router = useRouter();
  const [isSending, startTransition] = useTransition();
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const range = device.tempRange ?? { min: 0, max: 40, step: 1, unit: '°' };
  const unit = range.unit || '°';
  const target = device.targetTemp;
  const locked = !device.online || isSending;

  // Yêu cầu 1 lệnh → mở dialog xác nhận (không gửi ngay).
  const ask = (label: string, input: ControlInput) => {
    setError(null);
    setNotice(null);
    setPending({ label, input });
  };

  const confirm = () => {
    if (!pending) return;
    const input = pending.input;
    setPending(null);
    startTransition(async () => {
      const res = await sendDeviceCommand(device.id, input);
      if (res.ok) {
        setNotice('Command sent.');
        router.refresh(); // đọc lại status mới từ server
      } else {
        setError(res.error ?? 'Command failed.');
      }
    });
  };

  const bumpTarget = (delta: number) => {
    if (target == null) return;
    const next = round1(clamp(target + delta, range.min, range.max));
    if (next === target) return;
    ask(`Set target temperature to ${next}${unit}?`, { target: next });
  };

  const toggle = (key: 'power' | 'light' | 'purify', label: string) => {
    const cur = device[key];
    if (cur == null) return;
    const next = !cur;
    ask(`Turn ${label} ${next ? 'ON' : 'OFF'}?`, { [key]: next });
  };

  const toggles: { key: 'power' | 'light' | 'purify'; label: string }[] = [
    { key: 'power', label: 'Power' },
    { key: 'light', label: 'Light' },
    { key: 'purify', label: 'Disinfection' },
  ];

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <OnlineChip online={device.online} />
        {device.fault != null && device.fault !== 0 && (
          <span style={{ color: '#D9534F', fontSize: 12 }}>⚠ Fault code {device.fault}</span>
        )}
      </div>

      {!device.online && (
        <div className="banner" style={bannerStyle('#8A6D3B', 'rgba(196,135,58,0.12)')}>
          Device is offline - controls are disabled. Cloud commands won&apos;t reach it.
        </div>
      )}
      {error && (
        <div className="banner" style={bannerStyle('#D9534F', 'rgba(217,83,79,0.12)')}>
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="banner" style={bannerStyle('#3FB56B', 'rgba(63,181,107,0.12)')}>
          {notice}
        </div>
      )}

      {/* ── Nhiệt độ ── */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Metric label="CURRENT" value={device.currentTemp == null ? '—' : `${device.currentTemp}${unit}`} />
          <Metric label="TARGET" value={target == null ? '—' : `${target}${unit}`} gold />
        </div>
        {target != null && device.tempRange && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            <StepBtn disabled={locked} onClick={() => bumpTarget(-range.step)}>
              −
            </StepBtn>
            <div style={{ minWidth: 90, textAlign: 'center', fontSize: 30, color: '#C4873A' }}>
              {target}
              {unit}
            </div>
            <StepBtn disabled={locked} onClick={() => bumpTarget(range.step)}>
              +
            </StepBtn>
          </div>
        )}
        {device.tempRange && (
          <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 8 }}>
            Range {range.min}–{range.max}
            {unit} · step {range.step}
          </div>
        )}
      </section>

      {/* ── Công tắc (chỉ hiện DP thiết bị có) ── */}
      <section style={{ ...cardStyle, display: 'flex', gap: 10 }}>
        {toggles.filter((t) => device[t.key] != null).length === 0 ? (
          <span className="muted" style={{ fontSize: 13 }}>
            No switchable controls on this device.
          </span>
        ) : (
          toggles
            .filter((t) => device[t.key] != null)
            .map((t) => {
              const on = !!device[t.key];
              return (
                <button
                  key={t.key}
                  type="button"
                  disabled={locked}
                  onClick={() => toggle(t.key, t.label)}
                  style={toggleStyle(on, locked)}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{on ? 'ON' : 'OFF'}</div>
                </button>
              );
            })
        )}
      </section>

      {/* ── Dialog xác nhận ── */}
      {pending && (
        <div style={overlayStyle} onClick={() => setPending(null)}>
          <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, marginBottom: 6 }}>Confirm</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
              {pending.label}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setPending(null)} style={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={confirm} style={btnGold}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div className="muted" style={{ fontSize: 10, letterSpacing: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, marginTop: 4, color: gold ? '#C4873A' : '#F5ECD7' }}>{value}</div>
    </div>
  );
}

function StepBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        border: '1px solid rgba(245,236,215,0.25)',
        background: 'transparent',
        color: '#F5ECD7',
        fontSize: 22,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(245,236,215,0.12)',
  borderRadius: 14,
  padding: 18,
  marginTop: 14,
};

const bannerStyle = (color: string, bg: string): React.CSSProperties => ({
  color,
  background: bg,
  border: `1px solid ${color}`,
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  marginBottom: 12,
});

const toggleStyle = (on: boolean, locked: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '14px 8px',
  borderRadius: 12,
  border: '1px solid rgba(245,236,215,0.15)',
  background: on ? '#C4873A' : 'transparent',
  color: on ? '#0A0A0F' : '#B9B2A0',
  cursor: locked ? 'not-allowed' : 'pointer',
  opacity: locked ? 0.5 : 1,
});

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};

const dialogStyle: React.CSSProperties = {
  background: '#141118',
  border: '1px solid rgba(245,236,215,0.15)',
  borderRadius: 14,
  padding: 22,
  width: 340,
  maxWidth: '90vw',
};

const btnGhost: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  border: '1px solid rgba(245,236,215,0.2)',
  background: 'transparent',
  color: '#B9B2A0',
  cursor: 'pointer',
};

const btnGold: React.CSSProperties = {
  padding: '8px 18px',
  borderRadius: 8,
  border: 'none',
  background: '#C4873A',
  color: '#0A0A0F',
  fontWeight: 600,
  cursor: 'pointer',
};
