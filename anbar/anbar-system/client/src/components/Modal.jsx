import React from 'react';

export default function Modal({ title, onClose, children, footer, width }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={width ? { width } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <span className="btn btn-outline btn-sm" onClick={onClose}>
            بستن ✕
          </span>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
