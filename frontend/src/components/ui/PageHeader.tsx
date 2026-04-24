export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">{title}</div>
        <div className="page-desc">{description}</div>
      </div>
      {actions ? <div className="btn-group">{actions}</div> : null}
    </div>
  )
}
