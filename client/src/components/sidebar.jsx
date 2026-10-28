export default function Sidebar({ user, onLeave }) {
  return (
    <div className="mzsidebar">
      <div className="sidebarhome" title="Leave room">
        <div className="sidebar-home-button" onClick={onLeave} />
      </div>
      <div className="sidebarspace" />
      <div className="sidebarprofile" title={user?.username}>
        <img
          src={user?.avatar}
          alt="me"
          className="sidebar-profile-button"
          onClick={onLeave}
        />
      </div>
    </div>
  );
}