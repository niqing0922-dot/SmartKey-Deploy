import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '@/lib/format'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'xs'
}

export function Button({ children, className, variant = 'default', size = 'md', ...props }: PropsWithChildren<Props>) {
  return <button className={cn('btn', `btn-${variant}`, `btn-${size}`, className)} {...props}>{children}</button>
}
