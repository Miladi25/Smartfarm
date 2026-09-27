import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Settings({ user }) {
  const [profiles, setProfiles] = useState([])
  const [farms, setFarms] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'user',
    farm_id: '',
  })

  const [message, setMessage] = useState({
    type: '',
    text: '',
  })

  // =========================================================
  // USER ACCESS
  // =========================================================

  const isSuperAdmin =
    user?.is_super_admin === true ||
    user?.isSuperAdmin === true

  const isAdmin =
    user?.role === 'admin' || isSuperAdmin

  const currentFarmId =
    user?.farm_id || null

  // =========================================================
  // MESSAGE
  // =========================================================

  const showMessage = (type, text) => {
    setMessage({
      type,
      text,
    })

    setTimeout(() => {
      setMessage({
        type: '',
        text: '',
      })
    }, 3500)
  }

  // =========================================================
  // DATE FORMAT
  // =========================================================

  const formatDate = (date) => {
    if (!date) return '-'

    try {
      return new Date(date).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return '-'
    }
  }

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = async () => {
    setLoading(true)

    try {
      // =====================================================
      // LOAD FARMS
      // =====================================================

      let farmQuery = supabase
        .from('farms')
        .select(`
          id,
          farm_code,
          name,
          owner_name,
          phone,
          address,
          status,
          package_name,
          created_at
        `)
        .order('created_at', {
          ascending: true,
        })

      // Admin biasa hanya melihat farm sendiri.
      if (!isSuperAdmin && currentFarmId) {
        farmQuery = farmQuery.eq(
          'id',
          currentFarmId
        )
      }

      const {
        data: farmData,
        error: farmError,
      } = await farmQuery

      if (farmError) {
        throw farmError
      }

      // =====================================================
      // LOAD PROFILES
      // =====================================================

      let profileQuery = supabase
        .from('profiles')
        .select(`
          id,
          username,
          full_name,
          role,
          farm_id,
          is_super_admin,
          created_at
        `)
        .order('created_at', {
          ascending: true,
        })

      /*
       * Super Admin tetap bisa melihat akun seluruh farm.
       *
       * Tetapi akun Super Admin sendiri tidak dimasukkan
       * ke daftar pengguna peternakan.
       */
      if (isSuperAdmin) {
        profileQuery = profileQuery.eq(
          'is_super_admin',
          false
        )
      } else if (currentFarmId) {
        /*
         * Admin hanya melihat pengguna yang berada
         * di farm miliknya.
         */
        profileQuery = profileQuery
          .eq('farm_id', currentFarmId)
          .eq('is_super_admin', false)
      } else {
        /*
         * Jika akun tidak mempunyai farm,
         * jangan tampilkan akun lain.
         */
        profileQuery = profileQuery
          .eq('id', user?.id || '')
          .eq('is_super_admin', false)
      }

      const {
        data: profileData,
        error: profileError,
      } = await profileQuery

      if (profileError) {
        throw profileError
      }

      setFarms(farmData || [])
      setProfiles(profileData || [])
    } catch (error) {
      console.error(
        'Gagal mengambil data pengaturan:',
        error
      )

      showMessage(
        'error',
        `Gagal mengambil data: ${
          error.message || 'Terjadi kesalahan'
        }`
      )
    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadData()
  }, [
    isSuperAdmin,
    currentFarmId,
    user?.id,
  ])

  // =========================================================
  // CURRENT FARM
  // =========================================================

  const currentFarm = useMemo(() => {
    if (!currentFarmId) {
      return null
    }

    return farms.find(
      (farm) => farm.id === currentFarmId
    )
  }, [farms, currentFarmId])

  // =========================================================
  // FILTER USERS
  // =========================================================

  const filteredProfiles = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase()

    if (!keyword) {
      return profiles
    }

    return profiles.filter((profile) => {
      const searchable = [
        profile.username,
        profile.full_name,
        profile.role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(keyword)
    })
  }, [profiles, search])

  // =========================================================
  // OPEN ADD MODAL
  // =========================================================

  const openAddModal = () => {
    if (!isAdmin) {
      showMessage(
        'error',
        'Anda tidak memiliki akses mengelola pengguna.'
      )

      return
    }

    if (!isSuperAdmin && !currentFarmId) {
      showMessage(
        'error',
        'Akun Anda belum terhubung ke peternakan.'
      )

      return
    }

    setEditingUser(null)

    setForm({
      username: '',
      password: '',
      full_name: '',
      role: 'user',
      farm_id: isSuperAdmin
        ? ''
        : currentFarmId || '',
    })

    setShowModal(true)
  }

  // =========================================================
  // OPEN EDIT MODAL
  // =========================================================

  const openEditModal = (profile) => {
    /*
     * Super Admin tidak bisa diedit melalui
     * pengelolaan pengguna farm.
     */
    if (profile.is_super_admin === true) {
      showMessage(
        'error',
        'Akun ini tidak dapat diedit dari halaman pengguna.'
      )

      return
    }

    /*
     * Admin farm tidak boleh mengedit akun farm lain.
     */
    if (
      !isSuperAdmin &&
      profile.farm_id !== currentFarmId
    ) {
      showMessage(
        'error',
        'Anda tidak dapat mengedit akun dari peternakan lain.'
      )

      return
    }

    setEditingUser(profile)

    setForm({
      username: profile.username || '',
      password: '',
      full_name: profile.full_name || '',
      role: profile.role || 'user',
      farm_id:
        profile.farm_id ||
        currentFarmId ||
        '',
    })

    setShowModal(true)
  }

  // =========================================================
  // CLOSE MODAL
  // =========================================================

  const closeModal = () => {
    if (saving) {
      return
    }

    setShowModal(false)
    setEditingUser(null)

    setForm({
      username: '',
      password: '',
      full_name: '',
      role: 'user',
      farm_id: '',
    })
  }

  // =========================================================
  // SAVE USER
  // =========================================================

  const saveUser = async (event) => {
    event.preventDefault()

    if (!isAdmin) {
      showMessage(
        'error',
        'Anda tidak memiliki akses.'
      )

      return
    }

    const username = form.username.trim()
    const fullName = form.full_name.trim()
    const password = form.password.trim()

    if (!username) {
      showMessage(
        'error',
        'Username wajib diisi.'
      )

      return
    }

    if (!editingUser && !password) {
      showMessage(
        'error',
        'Password wajib diisi.'
      )

      return
    }

    if (!['admin', 'user'].includes(form.role)) {
      showMessage(
        'error',
        'Role tidak valid.'
      )

      return
    }

    /*
     * Super Admin bisa memilih farm.
     * Admin biasa selalu menggunakan farm miliknya.
     */
    const targetFarmId = isSuperAdmin
      ? form.farm_id || null
      : currentFarmId

    if (!targetFarmId) {
      showMessage(
        'error',
        'Peternakan wajib dipilih.'
      )

      return
    }

    setSaving(true)

    try {
      // =====================================================
      // CHECK DUPLICATE USERNAME
      // =====================================================

      let duplicateQuery = supabase
        .from('profiles')
        .select('id, username')
        .eq('username', username)

      if (editingUser) {
        duplicateQuery = duplicateQuery.neq(
          'id',
          editingUser.id
        )
      }

      const {
        data: duplicateData,
        error: duplicateError,
      } = await duplicateQuery.limit(1)

      if (duplicateError) {
        throw duplicateError
      }

      if (
        duplicateData &&
        duplicateData.length > 0
      ) {
        showMessage(
          'error',
          `Username "${username}" sudah digunakan.`
        )

        setSaving(false)
        return
      }

      // =====================================================
      // UPDATE USER
      // =====================================================

      if (editingUser) {
        const updateData = {
          username,
          full_name: fullName || null,
          role: form.role,
          farm_id: targetFarmId,
          is_super_admin: false,
        }

        if (password) {
          updateData.password = password
        }

        let updateQuery = supabase
          .from('profiles')
          .update(updateData)
          .eq('id', editingUser.id)
          .eq('is_super_admin', false)

        /*
         * Admin biasa hanya bisa mengubah
         * akun dari farm miliknya.
         */
        if (!isSuperAdmin) {
          updateQuery = updateQuery.eq(
            'farm_id',
            currentFarmId
          )
        }

        const {
          error: updateError,
        } = await updateQuery

        if (updateError) {
          throw updateError
        }

        showMessage(
          'success',
          'Akun berhasil diperbarui.'
        )
      }

      // =====================================================
      // INSERT USER
      // =====================================================

      else {
        const { error: insertError } =
          await supabase
            .from('profiles')
            .insert({
              username,
              password,
              full_name: fullName || null,
              role: form.role,
              farm_id: targetFarmId,
              is_super_admin: false,
            })

        if (insertError) {
          throw insertError
        }

        showMessage(
          'success',
          'Akun berhasil ditambahkan.'
        )
      }

      closeModal()

      await loadData()
    } catch (error) {
      console.error(
        'Gagal menyimpan pengguna:',
        error
      )

      showMessage(
        'error',
        `Gagal menyimpan pengguna: ${
          error.message || 'Terjadi kesalahan'
        }`
      )
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // DELETE USER
  // =========================================================

  const deleteUser = async (profile) => {
    if (profile.is_super_admin === true) {
      showMessage(
        'error',
        'Akun ini tidak dapat dihapus.'
      )

      return
    }

    if (!isAdmin) {
      showMessage(
        'error',
        'Anda tidak memiliki akses.'
      )

      return
    }

    if (
      !isSuperAdmin &&
      profile.farm_id !== currentFarmId
    ) {
      showMessage(
        'error',
        'Anda tidak dapat menghapus akun dari peternakan lain.'
      )

      return
    }

    /*
     * Jangan menghapus akun yang sedang digunakan.
     */
    if (profile.id === user?.id) {
      showMessage(
        'error',
        'Akun yang sedang digunakan tidak dapat dihapus.'
      )

      return
    }

    const confirmed = window.confirm(
      `Hapus akun "${profile.username}"?\n\nTindakan ini tidak dapat dibatalkan.`
    )

    if (!confirmed) {
      return
    }

    try {
      let deleteQuery = supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id)
        .eq('is_super_admin', false)

      if (!isSuperAdmin) {
        deleteQuery = deleteQuery.eq(
          'farm_id',
          currentFarmId
        )
      }

      const { error } = await deleteQuery

      if (error) {
        throw error
      }

      showMessage(
        'success',
        `Akun ${profile.username} berhasil dihapus.`
      )

      await loadData()
    } catch (error) {
      console.error(
        'Gagal menghapus pengguna:',
        error
      )

      showMessage(
        'error',
        `Gagal menghapus pengguna: ${
          error.message || 'Terjadi kesalahan'
        }`
      )
    }
  }

  // =========================================================
  // RESET PASSWORD
  // =========================================================

  const resetPassword = async (profile) => {
    if (profile.is_super_admin === true) {
      showMessage(
        'error',
        'Password akun ini tidak dapat diubah dari halaman ini.'
      )

      return
    }

    if (!isAdmin) {
      showMessage(
        'error',
        'Anda tidak memiliki akses.'
      )

      return
    }

    if (
      !isSuperAdmin &&
      profile.farm_id !== currentFarmId
    ) {
      showMessage(
        'error',
        'Anda tidak dapat mengubah akun peternakan lain.'
      )

      return
    }

    const newPassword = window.prompt(
      `Masukkan password baru untuk ${profile.username}:`
    )

    if (newPassword === null) {
      return
    }

    const password = newPassword.trim()

    if (!password) {
      showMessage(
        'error',
        'Password tidak boleh kosong.'
      )

      return
    }

    if (password.length < 4) {
      showMessage(
        'error',
        'Password minimal 4 karakter.'
      )

      return
    }

    try {
      let updateQuery = supabase
        .from('profiles')
        .update({
          password,
        })
        .eq('id', profile.id)
        .eq('is_super_admin', false)

      if (!isSuperAdmin) {
        updateQuery = updateQuery.eq(
          'farm_id',
          currentFarmId
        )
      }

      const { error } = await updateQuery

      if (error) {
        throw error
      }

      showMessage(
        'success',
        `Password ${profile.username} berhasil diubah.`
      )
    } catch (error) {
      console.error(
        'Gagal mengubah password:',
        error
      )

      showMessage(
        'error',
        `Gagal mengubah password: ${
          error.message || 'Terjadi kesalahan'
        }`
      )
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 text-sm text-slate-500">
            Memuat pengaturan...
          </p>
        </div>
      </div>
    )
  }

  // =========================================================
  // MAIN RENDER
  // =========================================================

  return (
    <div className="space-y-6">
      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Pengaturan
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Kelola akun dan akses sistem smartFarm.
        </p>
      </div>

      {/* =====================================================
          MESSAGE
      ====================================================== */}

      {message.text && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span className="mr-2">
            {message.type === 'success'
              ? '✓'
              : '⚠'}
          </span>

          {message.text}
        </div>
      )}

      {/* =====================================================
          ACCOUNT INFORMATION
      ====================================================== */}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Informasi Akun Saya
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Informasi administrator yang sedang digunakan.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard
            label="Nama Lengkap"
            value={
              user?.full_name ||
              'Belum diatur'
            }
          />

          <InfoCard
            label="Username"
            value={`@${user?.username || '-'}`}
          />

          <InfoCard
            label="Role"
            value={
              isSuperAdmin
                ? 'SUPER ADMIN'
                : user?.role === 'admin'
                  ? 'ADMINISTRATOR'
                  : 'USER'
            }
            highlight={isSuperAdmin}
          />
        </div>
      </section>

      {/* =====================================================
          USER MANAGEMENT
      ====================================================== */}

      {isAdmin && (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* HEADER */}

          <div className="border-b border-slate-100 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Kelola Pengguna
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Tambahkan, ubah, atau hapus akun pengguna smartFarm.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {/* SEARCH */}

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    🔎
                  </span>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Cari pengguna..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-50 sm:w-64"
                  />
                </div>

                {/* ADD */}

                <button
                  type="button"
                  onClick={openAddModal}
                  className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98]"
                >
                  ＋ Tambah Pengguna
                </button>
              </div>
            </div>
          </div>

          {/* =================================================
              DESKTOP TABLE
          ================================================== */}

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[850px]">
              <thead className="bg-slate-50">
                <tr className="border-y border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-4">
                    Pengguna
                  </th>

                  <th className="px-6 py-4">
                    Username
                  </th>

                  <th className="px-6 py-4">
                    Role
                  </th>

                  {isSuperAdmin && (
                    <th className="px-6 py-4">
                      Peternakan
                    </th>
                  )}

                  <th className="px-6 py-4">
                    Terdaftar
                  </th>

                  <th className="px-6 py-4 text-right">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredProfiles.map(
                  (profile) => {
                    const profileFarm =
                      farms.find(
                        (farm) =>
                          farm.id ===
                          profile.farm_id
                      )

                    return (
                      <tr
                        key={profile.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50"
                      >
                        {/* USER */}

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${
                                profile.role ===
                                'admin'
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {(
                                profile.full_name ||
                                profile.username ||
                                '?'
                              )
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <p className="font-semibold text-slate-900">
                                {profile.full_name ||
                                  'Tanpa Nama'}
                              </p>

                              {profile.id ===
                                user?.id && (
                                <p className="mt-0.5 text-xs font-medium text-red-600">
                                  Akun saya
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* USERNAME */}

                        <td className="px-6 py-5 text-sm text-slate-600">
                          @{profile.username}
                        </td>

                        {/* ROLE */}

                        <td className="px-6 py-5">
                          <RoleBadge
                            role={
                              profile.role
                            }
                          />
                        </td>

                        {/* FARM FOR SUPER ADMIN */}

                        {isSuperAdmin && (
                          <td className="px-6 py-5">
                            <div>
                              <p className="text-sm font-medium text-slate-700">
                                {profileFarm?.name ||
                                  'Tidak diketahui'}
                              </p>

                              <p className="text-xs text-red-600">
                                {profileFarm?.farm_code ||
                                  '-'}
                              </p>
                            </div>
                          </td>
                        )}

                        {/* DATE */}

                        <td className="px-6 py-5 text-sm text-slate-500">
                          {formatDate(
                            profile.created_at
                          )}
                        </td>

                        {/* ACTION */}

                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  profile
                                )
                              }
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              ✏️ Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                resetPassword(
                                  profile
                                )
                              }
                              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                              🔑 Password
                            </button>

                            <button
                              type="button"
                              disabled={
                                profile.id ===
                                user?.id
                              }
                              onClick={() =>
                                deleteUser(
                                  profile
                                )
                              }
                              className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>

          {/* =================================================
              MOBILE USER CARDS
          ================================================== */}

          <div className="grid gap-3 p-4 lg:hidden">
            {filteredProfiles.map(
              (profile) => {
                const profileFarm =
                  farms.find(
                    (farm) =>
                      farm.id ===
                      profile.farm_id
                  )

                return (
                  <div
                    key={profile.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold ${
                          profile.role ===
                          'admin'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {(
                          profile.full_name ||
                          profile.username ||
                          '?'
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">
                          {profile.full_name ||
                            'Tanpa Nama'}
                        </p>

                        <p className="truncate text-xs text-slate-500">
                          @{profile.username}
                        </p>

                        {profile.id ===
                          user?.id && (
                          <p className="mt-1 text-xs font-semibold text-red-600">
                            Akun saya
                          </p>
                        )}
                      </div>

                      <RoleBadge
                        role={profile.role}
                      />
                    </div>

                    {isSuperAdmin && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Peternakan
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {profileFarm?.name ||
                            'Tidak diketahui'}
                        </p>

                        <p className="text-xs text-red-600">
                          {profileFarm?.farm_code ||
                            '-'}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(
                            profile
                          )
                        }
                        className="flex-1 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700"
                      >
                        ✏️ Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          resetPassword(
                            profile
                          )
                        }
                        className="flex-1 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700"
                      >
                        🔑 Password
                      </button>

                      <button
                        type="button"
                        disabled={
                          profile.id ===
                          user?.id
                        }
                        onClick={() =>
                          deleteUser(
                            profile
                          )
                        }
                        className="flex-1 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600 disabled:opacity-40"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  </div>
                )
              }
            )}
          </div>

          {/* =================================================
              EMPTY STATE
          ================================================== */}

          {filteredProfiles.length ===
            0 && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                👤
              </div>

              <h3 className="mt-4 font-semibold text-slate-800">
                Tidak ada pengguna
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Belum ada akun pengguna yang
                sesuai dengan pencarian.
              </p>
            </div>
          )}

          {/* =================================================
              FOOTER
          ================================================== */}

          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                Menampilkan{' '}
                <strong>
                  {filteredProfiles.length}
                </strong>{' '}
                dari{' '}
                <strong>
                  {profiles.length}
                </strong>{' '}
                pengguna
              </p>

              <button
                type="button"
                onClick={loadData}
                className="text-xs font-semibold text-red-600 transition hover:text-red-700"
              >
                ↻ Refresh Data
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          USER WITHOUT ADMIN ACCESS
      ====================================================== */}

      {!isAdmin && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              🔒
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                Pengelolaan pengguna
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Akun User tidak memiliki akses untuk
                mengelola akun pengguna.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          USER MODAL
      ====================================================== */}

      {showModal && (
        <Modal
          title={
            editingUser
              ? 'Edit Pengguna'
              : 'Tambah Pengguna'
          }
          subtitle={
            editingUser
              ? 'Perbarui data akun pengguna.'
              : 'Buat akun Admin atau User baru.'
          }
          onClose={closeModal}
          disabled={saving}
        >
          <form
            onSubmit={saveUser}
            className="space-y-4"
          >
            {/* USERNAME */}

            <FormInput
              label="Username"
              value={form.username}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  username: value,
                }))
              }
              placeholder="Contoh: admin2"
              required
            />

            {/* PASSWORD */}

            <FormInput
              label={
                editingUser
                  ? 'Password Baru'
                  : 'Password'
              }
              type="password"
              value={form.password}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  password: value,
                }))
              }
              placeholder={
                editingUser
                  ? 'Kosongkan jika tidak ingin mengubah'
                  : 'Masukkan password'
              }
              required={!editingUser}
            />

            {/* FULL NAME */}

            <FormInput
              label="Nama Lengkap"
              value={form.full_name}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  full_name: value,
                }))
              }
              placeholder="Nama lengkap pengguna"
            />

            {/* ROLE */}

            <FormSelect
              label="Role"
              value={form.role}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  role: value,
                }))
              }
              options={[
                {
                  value: 'user',
                  label: 'User',
                },
                {
                  value: 'admin',
                  label: 'Admin',
                },
              ]}
            />

            {/* FARM FOR SUPER ADMIN */}

            {isSuperAdmin && (
              <FormSelect
                label="Peternakan"
                value={form.farm_id}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    farm_id: value,
                  }))
                }
                options={[
                  {
                    value: '',
                    label:
                      'Pilih peternakan...',
                  },
                  ...farms.map((farm) => ({
                    value: farm.id,
                    label: `${farm.farm_code} — ${farm.name}`,
                  })),
                ]}
              />
            )}

            {/* FARM FOR ADMIN */}

            {!isSuperAdmin && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400">
                  Peternakan
                </p>

                <p className="mt-1 font-semibold text-slate-800">
                  {currentFarm?.name ||
                    'Tidak diketahui'}
                </p>

                <p className="mt-1 text-xs text-red-600">
                  {currentFarm?.farm_code || '-'}
                </p>
              </div>
            )}

            {/* ACCESS INFO */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-700">
                Hak Akses
              </p>

              {form.role === 'admin' ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  <li>
                    ✓ Mengelola data peternakan
                  </li>

                  <li>
                    ✓ Mengelola pengguna
                  </li>

                  <li>
                    ✓ Mengakses laporan
                  </li>

                  <li>
                    ✕ Tidak dapat mengakses farm lain
                  </li>
                </ul>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-slate-500">
                  <li>
                    ✓ Menginput data operasional
                  </li>

                  <li>
                    ✓ Mengakses data sesuai izin
                  </li>

                  <li>
                    ✕ Tidak dapat mengelola pengguna
                  </li>

                  <li>
                    ✕ Tidak dapat mengakses farm lain
                  </li>
                </ul>
              )}
            </div>

            {/* BUTTON */}

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {saving
                  ? 'Menyimpan...'
                  : editingUser
                    ? 'Simpan Perubahan'
                    : 'Tambah Pengguna'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ===========================================================
// INFO CARD
// ===========================================================

function InfoCard({
  label,
  value,
  highlight = false,
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-3 text-lg font-semibold ${
          highlight
            ? 'text-red-600'
            : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

// ===========================================================
// ROLE BADGE
// ===========================================================

function RoleBadge({ role }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
        ADMIN
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
      USER
    </span>
  )
}

// ===========================================================
// FORM INPUT
// ===========================================================

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
      />
    </div>
  )
}

// ===========================================================
// FORM SELECT
// ===========================================================

function FormSelect({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ===========================================================
// MODAL
// ===========================================================

function Modal({
  title,
  subtitle,
  children,
  onClose,
  disabled = false,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* HEADER */}

        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5">
          <div className="pr-5">
            <h3 className="text-lg font-bold text-slate-900">
              {title}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* BODY */}

        <div className="max-h-[calc(92vh-100px)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Settings