import { cn } from '@/lib/format'

export function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: string }) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>
}
