import { cn } from '@/lib/format'

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('card', className)}>{children}</section>
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </Card>
  )
}
