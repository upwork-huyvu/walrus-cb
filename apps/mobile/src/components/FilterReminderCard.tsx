import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { F, useTheme } from '../theme';
import type { Navigate } from '../navigation';
import {
  getReminder,
  markReplaced,
  saveReminder,
  type Reminder,
  type ReminderStage,
} from '../services/reminders';

const RED = '#E5484D';

// Màu theo mức khẩn (khớp UI cũ: >21 xám · ≤21 vàng · ≤7 đỏ · quá hạn đỏ).
function stageColor(stage: ReminderStage, ochre: string, muted: string): string {
  if (stage === 'overdue' || stage === 'soon') return RED;
  if (stage === 'warn') return ochre;
  return muted;
}

function statusLine(r: Reminder): string {
  if (r.stage === 'overdue') return `${Math.abs(r.daysRemaining)} days overdue - replace now`;
  return `Next change in ${r.daysRemaining} day${r.daysRemaining === 1 ? '' : 's'}`;
}

// Card "Filter reminder" trên Device Detail (per-device, backend qua services/reminders.ts).
// Countdown + màu khẩn + "Replaced now" (reset 90 ngày) + "Buy filters". Dev/chưa-backend → mock local.
export default function FilterReminderCard({
  deviceId,
  uid,
  navigate,
}: {
  deviceId: string;
  uid: string;
  navigate: Navigate;
}) {
  const C = useTheme();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReminder(await getReminder(deviceId, uid));
    } catch {
      setReminder(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const startTracking = async () => {
    setBusy(true);
    try {
      setReminder(await saveReminder(deviceId, uid, {})); // tạo với mặc định 90 ngày
    } catch {
      /* giữ nguyên */
    } finally {
      setBusy(false);
    }
  };

  const replaced = async () => {
    setBusy(true);
    try {
      setReminder(await markReplaced(deviceId, uid));
    } catch {
      /* giữ nguyên */
    } finally {
      setBusy(false);
    }
  };

  const card = (children: ReactNode) => (
    <View
      style={{
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: 'rgba(245,236,215,0.03)',
        borderRadius: 24,
        padding: 20,
      }}
    >
      <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 11, letterSpacing: 3, marginBottom: 14 }}>
        FILTER REMINDER
      </Text>
      {children}
    </View>
  );

  if (loading) {
    return card(<ActivityIndicator color={C.ochre} />);
  }

  if (!reminder) {
    return card(
      <>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
          Track your filter and Walrus will remind you before the next change (every 90 days).
        </Text>
        <Pressable
          onPress={() => void startTracking()}
          disabled={busy}
          style={{
            borderWidth: 1,
            borderColor: C.ochre,
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: 'center',
            backgroundColor: 'rgba(196,135,58,0.08)',
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 14 }}>Start tracking</Text>
        </Pressable>
      </>,
    );
  }

  const color = stageColor(reminder.stage, C.ochre, C.muted);
  const pct = Math.max(0, Math.min(1, reminder.daysRemaining / reminder.intervalDays));
  const overdue = reminder.stage === 'overdue';

  return card(
    <>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <Text style={{ fontFamily: F.headline, color: overdue ? RED : C.white, fontSize: 40 }}>
          {overdue ? Math.abs(reminder.daysRemaining) : reminder.daysRemaining}
        </Text>
        <Text style={{ fontFamily: F.body, color: C.muted, fontSize: 13 }}>
          {overdue ? 'days overdue' : 'days left'}
        </Text>
      </View>

      {/* progress còn lại */}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden', marginBottom: 10 }}>
        <View style={{ width: `${Math.round(pct * 100)}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>

      <Text style={{ fontFamily: F.body, color, fontSize: 12, marginBottom: 16 }}>{statusLine(reminder)}</Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => void replaced()}
          disabled={busy}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#4CAF50',
            borderRadius: 999,
            paddingVertical: 13,
            alignItems: 'center',
            backgroundColor: 'rgba(76,175,80,0.08)',
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ fontFamily: F.body, color: '#4CAF50', fontSize: 13 }}>✓ Replaced now</Text>
        </Pressable>
        <Pressable
          onPress={() => navigate('shop')}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: C.ochre,
            borderRadius: 999,
            paddingVertical: 13,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: F.body, color: C.ochre, fontSize: 13 }}>Buy filters</Text>
        </Pressable>
      </View>
    </>,
  );
}
