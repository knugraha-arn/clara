'use client'

export default function LoginPage() {
  const handleLogin = () => {
    alert('Login dengan Google akan segera aktif')
  }

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Login Clara</h1>
      <button 
        onClick={handleLogin}
        style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}
      >
        Login dengan Google
      </button>
    </div>
  )
}
