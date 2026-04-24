import { Button } from './Button'

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="overlay open" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header-row">
          <div className="modal-title">{title}</div>
          <Button variant="ghost" size="xs" onClick={onClose}>Close</Button>
        </div>
        <div className="modal-content">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
