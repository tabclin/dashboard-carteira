import DRIPlano from '@/components/dri/dri-plano'

export default async function DRIPlanoPage({
  params,
}: {
  params: Promise<{ avaliacaoId: string }>
}) {
  const { avaliacaoId } = await params
  return (
    <div className="flex-1 overflow-y-auto">
      <DRIPlano avaliacaoId={avaliacaoId} />
    </div>
  )
}
