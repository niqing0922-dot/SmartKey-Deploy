import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/States'

export function DeferredPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="page-body">
        <Card>
          <Alert tone="info">This module is intentionally isolated from the core workflow. Configure optional integrations in Settings before using it.</Alert>
        </Card>
      </div>
    </>
  )
}
