import { useState } from 'react'
import { supabase } from '../lib/supabase'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState('')

  const handleLogin = async (event) => {
    event.preventDefault()

    setError('')

    const cleanUsername = username.trim()

    if (!cleanUsername) {
      setError('Username wajib diisi.')
      return
    }

    if (!password) {
      setError('Password wajib diisi.')
      return
    }

    setLoading(true)

    try {
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .select(
          `
            id,
            username,
            full_name,
            role,
            is_super_admin,
            farm_id,
            is_active,
            created_at,
            farms (
              id,
              farm_code,
              name,
              owner_name,
              status,
              package_name
            )
          `
        )
        .eq('username', cleanUsername)
        .eq('password', password)
        .maybeSingle()

      if (supabaseError) {
        throw supabaseError
      }

      if (!data) {
        setError(
          'Username atau password yang kamu masukkan salah.'
        )
        return
      }

      // ==========================================
      // CEK STATUS AKUN
      // ==========================================

      if (
        data.is_active === false &&
        !data.is_super_admin
      ) {
        setError(
          'Akun ini sedang dinonaktifkan. Hubungi administrator.'
        )
        return
      }

      // ==========================================
      // CEK STATUS FARM
      // ==========================================

      if (
        !data.is_super_admin &&
        data.farms &&
        data.farms.status !== 'active'
      ) {
        setError(
          'Farm kamu sedang tidak aktif. Silakan hubungi administrator.'
        )
        return
      }

      // ==========================================
      // NORMALISASI DATA FARM
      // ==========================================

      const farm = data.farms || null

      const loggedInUser = {
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        role: data.role,

        is_super_admin:
          data.is_super_admin === true,

        farm_id: data.farm_id || null,

        is_active:
          data.is_active !== false,

        created_at: data.created_at,

        farm: farm
          ? {
              id: farm.id,
              farm_code: farm.farm_code,
              name: farm.name,
              owner_name: farm.owner_name,
              status: farm.status,
              package_name: farm.package_name,
            }
          : null,

        farm_code:
          farm?.farm_code || null,

        farm_name:
          farm?.name || null,

        package_name:
          farm?.package_name || null,
      }

      // ==========================================
      // SIMPAN SESSION LOCAL
      // ==========================================

      localStorage.setItem(
        'farmfin_user',
        JSON.stringify(loggedInUser)
      )

      // ==========================================
      // KIRIM USER KE APP
      // ==========================================

      if (typeof onLogin === 'function') {
        onLogin(loggedInUser)
      }
    } catch (loginError) {
      console.error(
        'Login error:',
        loginError
      )

      setError(
        `Gagal login: ${
          loginError.message ||
          'Terjadi kesalahan.'
        }`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md">

          {/* BRAND */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-red-600 text-4xl shadow-xl shadow-red-600/20">
              🐔
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white">
              smart<span className="text-red-500">Farm</span>
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Sistem Manajemen Peternakan Digital
            </p>
          </div>

          {/* LOGIN CARD */}
          <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">

            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Selamat Datang 👋
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Silakan masuk untuk melanjutkan ke smartFarm.
              </p>
            </div>

            {/* ERROR */}
            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">
                    ⚠️
                  </span>

                  <p className="text-sm font-medium text-red-700">
                    {error}
                  </p>
                </div>
              </div>
            )}

            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >

              {/* USERNAME */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Username
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    👤
                  </span>

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value
                      )
                    }
                    placeholder="Masukkan username"
                    autoComplete="username"
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    🔒
                  </span>

                  <input
                    id="password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    disabled={loading}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                    aria-label={
                      showPassword
                        ? 'Sembunyikan password'
                        : 'Tampilkan password'
                    }
                  >
                    {showPassword
                      ? '🙈'
                      : '👁️'}
                  </button>
                </div>
              </div>

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 hover:shadow-red-600/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Memproses...
                  </>
                ) : (
                  <>
                    Masuk ke smartFarm
                    <span>→</span>
                  </>
                )}
              </button>
            </form>

            {/* INFO */}
            <div className="mt-6 border-t border-slate-100 pt-5 text-center">
              <p className="text-xs text-slate-400">
                Akses sistem berdasarkan akun dan farm yang terdaftar.
              </p>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              © 2026 smartFarm
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Developed by Miladi — IT Developer
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login