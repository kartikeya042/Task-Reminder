export default function LogoutConfirmModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div
      className="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      onClick={onCancel}
    >
      <div className="logout-modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="logout-modal-title" className="logout-modal-title">
          Log out?
        </h2>
        <p className="logout-modal-text">Are you sure you want to log out?</p>
        <div className="logout-modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
