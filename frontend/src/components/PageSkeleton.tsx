function Bone({ h = 16, w = '100%', r = 8 }: { h?: number; w?: string | number; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto px-8 py-6">
      {[1, 2, 3].map(i => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <div style={{ maxWidth: '70%', width: i % 2 === 0 ? '60%' : '75%' }}>
            <div className="skeleton rounded-2xl" style={{ height: i === 2 ? 96 : 56 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-6" style={{ background: '#FFFFFF', border: '1px solid #E2DDD6' }}>
          <Bone h={48} w={48} r={12} />
          <div className="mt-4 flex flex-col gap-2">
            <Bone h={18} w="60%" />
            <Bone h={14} />
            <Bone h={14} w="80%" />
          </div>
          <Bone h={40} r={8} />
        </div>
      ))}
    </div>
  )
}

export default function PageSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-8" style={{ background: '#F5F0E8' }}>
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <Bone h={36} w="40%" r={6} />
        <Bone h={20} w="60%" r={6} />
        <CardGridSkeleton count={3} />
      </div>
    </div>
  )
}
