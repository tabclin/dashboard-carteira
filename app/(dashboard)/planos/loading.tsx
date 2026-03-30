export default function Loading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="skeleton h-9 w-64 rounded-xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card"><div className="skeleton h-16 rounded-lg" /></div>
        ))}
      </div>
      <div className="card"><div className="skeleton h-48 rounded-lg" /></div>
    </div>
  )
}
