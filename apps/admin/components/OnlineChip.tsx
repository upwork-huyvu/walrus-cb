// Chip online/offline dùng chung (danh sách + detail thiết bị).
export default function OnlineChip({ online }: { online: boolean }) {
  const color = online ? '#3FB56B' : '#8A8A8A';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        letterSpacing: 1,
        color,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: color,
          display: 'inline-block',
        }}
      />
      {online ? 'ONLINE' : 'OFFLINE'}
    </span>
  );
}
