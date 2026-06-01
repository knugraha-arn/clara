export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Clara</h1>
        <p className="mt-4">Surat Keluar Management System</p>
        <a href="/login" className="mt-6 inline-block bg-blue-600 text-white px-6 py-2 rounded">
          Login
        </a>
      </div>
    </div>
  )
}
