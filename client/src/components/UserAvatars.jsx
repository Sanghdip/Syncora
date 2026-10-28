export default function UserAvatars({ members }) {
  if (!members?.length) return null;

  // Show up to 3 avatars, then a count bubble
  const shown = members.slice(0, 3);
  const extra = Math.max(0, members.length - shown.length);

  return (
    <div className="user-avatars">
      {shown.map((m, i) => (
        <img
          key={m.socketId || m.username || i}
          src={m.avatar}
          alt={m.username}
          title={m.username}
          className="user-avatar"
          style={{ zIndex: 10 - i }}
        />
      ))}
      {extra > 0 && <span className="user-avatar user-avatar-more">+{extra}</span>}
    </div>
  );
}