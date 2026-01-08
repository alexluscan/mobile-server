import React from "react";

export default function ConfirmDialog({ text, onConfirm, onCancel, disabled }) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <p>{text}</p>
        <div className="dialog-actions">
          <button className="danger" onClick={onConfirm} disabled={disabled}>
            Delete
          </button>
          <button onClick={onCancel} disabled={disabled}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
