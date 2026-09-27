import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function ChickenTypes({ user, farm }) {
  const [chickenTypes, setChickenTypes] = useState([])
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    farm_id: '',
  })

  const isSuperAdmin = user?.is_super_admin === true
  const isAdmin = user?.role === 'admin' && !isSuperAdmin

  const currentFarmId =
    farm?.farmId ||
    user?.farm_id ||
    null

  const currentFarmName =
    farm?.farmName ||
    farm?.name ||
    ''

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    loadData()
  }, [user?.id, user?.farm_id, farm?.farmId])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      // -----------------------------------------------------
      // LOAD FARMS
      // -----------------------------------------------------
      if (isSuperAdmin) {
        const { data: farmData, error: farmError } = await supabase
          .from('farms')
          .select(`
            id,
            farm_code,
            name,
            status
          `)
          .order('name', { ascending: true })

        if (farmError) throw farmError

        setFarms(farmData || [])
      }

      // -----------------------------------------------------
      // LOAD CHICKEN TYPES
      // -----------------------------------------------------

      let query = supabase
        .from('chicken_types')
        .select(`
          id,
          name,
          description,
          farm_id,
          created_by,
          created_at,
          farms (
            id,
            farm_code,
            name
          )
        `)
        .order('name', { ascending: true })

      // Admin / User hanya melihat farm sendiri
      if (!isSuperAdmin) {
        if (!currentFarmId) {
          setChickenTypes([])
          setLoading(false)
          return
        }

        query = query.eq('farm_id', currentFarmId)
      }

      const { data, error: chickenError } = await query

      if (chickenError) throw chickenError

      setChickenTypes(data || [])
    } catch (err) {
      console.error('Gagal memuat jenis ayam:', err)
      setError(
        err?.message ||
        'Gagal memuat data jenis ayam.'
      )
    } finally {
      setLoading(false)
    }
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredTypes = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) {
      return chickenTypes
    }

    return chickenTypes.filter((item) => {
      const name = item.name?.toLowerCase() || ''
      const description =
        item.description?.toLowerCase() || ''

      const farmName =
        item.farms?.name?.toLowerCase() || ''

      return (
        name.includes(keyword) ||
        description.includes(keyword) ||
        farmName.includes(keyword)
      )
    })
  }, [chickenTypes, search])

  // =========================================================
  // FORM
  // =========================================================

  function resetForm() {
    setForm({
      name: '',
      description: '',
      farm_id: isSuperAdmin ? '' : currentFarmId || '',
    })

    setEditingType(null)
  }

  function openAddModal() {
    if (!isAdmin && !isSuperAdmin) {
      return
    }

    setError('')
    setSuccess('')

    resetForm()

    if (!isSuperAdmin) {
      setForm({
        name: '',
        description: '',
        farm_id: currentFarmId || '',
      })
    }

    setShowModal(true)
  }

  function openEditModal(type) {
    // Super Admin tidak mengelola master jenis ayam
    if (!isAdmin) {
      return
    }

    // Admin hanya boleh edit milik farm sendiri
    if (
      currentFarmId &&
      type.farm_id !== currentFarmId
    ) {
      setError(
        'Anda hanya dapat mengelola jenis ayam dari peternakan sendiri.'
      )
      return
    }

    setError('')
    setSuccess('')

    setEditingType(type)

    setForm({
      name: type.name || '',
      description: type.description || '',
      farm_id: type.farm_id || currentFarmId || '',
    })

    setShowModal(true)
  }

  function closeModal() {
    if (saving) return

    setShowModal(false)
    resetForm()
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // =========================================================
  // SAVE
  // =========================================================

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setSuccess('')

    const name = form.name.trim()

    if (!name) {
      setError('Nama jenis ayam wajib diisi.')
      return
    }

    // Hanya admin farm yang boleh mengelola
    if (!isAdmin) {
      setError(
        'Hanya Admin Peternakan yang dapat mengelola jenis ayam.'
      )
      return
    }

    if (!currentFarmId) {
      setError(
        'Akun ini belum terhubung dengan peternakan.'
      )
      return
    }

    setSaving(true)

    try {
      // -----------------------------------------------------
      // CEK DUPLIKAT DALAM FARM YANG SAMA
      // -----------------------------------------------------

      let duplicateQuery = supabase
        .from('chicken_types')
        .select('id, name')
        .eq('farm_id', currentFarmId)
        .ilike('name', name)

      if (editingType) {
        duplicateQuery = duplicateQuery.neq(
          'id',
          editingType.id
        )
      }

      const {
        data: duplicateData,
        error: duplicateError,
      } = await duplicateQuery

      if (duplicateError) {
        throw duplicateError
      }

      if (duplicateData && duplicateData.length > 0) {
        setError(
          `Jenis ayam "${name}" sudah ada di peternakan ini.`
        )
        setSaving(false)
        return
      }

      // -----------------------------------------------------
      // UPDATE
      // -----------------------------------------------------

      if (editingType) {
        const { error: updateError } = await supabase
          .from('chicken_types')
          .update({
            name,
            description:
              form.description.trim() || null,
          })
          .eq('id', editingType.id)
          .eq('farm_id', currentFarmId)

        if (updateError) {
          throw updateError
        }

        setSuccess(
          `Jenis ayam "${name}" berhasil diperbarui.`
        )
      }

      // -----------------------------------------------------
      // INSERT
      // -----------------------------------------------------

      else {
        const { error: insertError } = await supabase
          .from('chicken_types')
          .insert({
            name,
            description:
              form.description.trim() || null,
            farm_id: currentFarmId,
            created_by: user?.id || null,
          })

        if (insertError) {
          throw insertError
        }

        setSuccess(
          `Jenis ayam "${name}" berhasil ditambahkan.`
        )
      }

      setShowModal(false)
      resetForm()

      await loadData()
    } catch (err) {
      console.error(
        'Gagal menyimpan jenis ayam:',
        err
      )

      setError(
        err?.message ||
        'Gagal menyimpan jenis ayam.'
      )
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // DELETE
  // =========================================================

  async function handleDelete(type) {
    if (!isAdmin) {
      setError(
        'Hanya Admin Peternakan yang dapat menghapus jenis ayam.'
      )
      return
    }

    if (
      currentFarmId &&
      type.farm_id !== currentFarmId
    ) {
      setError(
        'Anda tidak dapat menghapus jenis ayam dari peternakan lain.'
      )
      return
    }

    const confirmed = window.confirm(
      `Hapus jenis ayam "${type.name}"?\n\nPastikan jenis ayam ini belum digunakan oleh data populasi, produksi, kematian, atau transaksi.`
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      const { error: deleteError } = await supabase
        .from('chicken_types')
        .delete()
        .eq('id', type.id)
        .eq('farm_id', currentFarmId)

      if (deleteError) {
        throw deleteError
      }

      setSuccess(
        `Jenis ayam "${type.name}" berhasil dihapus.`
      )

      await loadData()
    } catch (err) {
      console.error(
        'Gagal menghapus jenis ayam:',
        err
      )

      setError(
        err?.message ||
        'Jenis ayam tidak dapat dihapus. Kemungkinan masih digunakan oleh data lain.'
      )
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-2xl text-white shadow-lg shadow-red-200">
              🐔
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Jenis Ayam
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Kelola jenis ayam yang digunakan dalam peternakan.
              </p>
            </div>
          </div>

          {!isSuperAdmin && currentFarmName && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {currentFarmName}
            </div>
          )}
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-red-700 active:scale-[0.98]"
          >
            <span className="text-lg">+</span>
            Tambah Jenis Ayam
          </button>
        )}
      </div>

      {/* ALERT */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <div className="flex items-start gap-2">
            <span>✓</span>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* SUPER ADMIN INFO */}
      {isSuperAdmin && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex gap-3">
            <div className="text-xl">ℹ️</div>

            <div>
              <h3 className="font-semibold text-blue-900">
                Mode Super Admin
              </h3>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                Super Admin tidak menjadi anggota peternakan.
                Data jenis ayam di bawah ditampilkan berdasarkan
                peternakan masing-masing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* USER INFO */}
      {!isAdmin && !isSuperAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex gap-3">
            <div className="text-xl">👤</div>

            <div>
              <h3 className="font-semibold text-slate-900">
                Daftar Jenis Ayam
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Anda dapat menggunakan jenis ayam yang telah
                dibuat oleh Admin Peternakan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH + STAT */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">

        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔎
          </span>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isSuperAdmin
                ? 'Cari jenis ayam atau peternakan...'
                : 'Cari jenis ayam...'
            }
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
          />
        </div>

        <div className="rounded-xl bg-white px-5 py-3 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-medium text-slate-500">
            Total Jenis Ayam
          </div>

          <div className="mt-1 text-xl font-bold text-slate-900">
            {filteredTypes.length}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 text-sm text-slate-500">
            Memuat jenis ayam...
          </p>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="text-5xl">🐔</div>

          <h3 className="mt-4 text-lg font-bold text-slate-900">
            Belum ada jenis ayam
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {isAdmin
              ? 'Tambahkan jenis ayam yang digunakan oleh peternakan ini.'
              : 'Belum ada jenis ayam yang tersedia untuk peternakan ini.'}
          </p>

          {isAdmin && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              + Tambah Jenis Ayam
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">

                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Jenis Ayam
                    </th>

                    {isSuperAdmin && (
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Peternakan
                      </th>
                    )}

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Keterangan
                    </th>

                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Dibuat
                    </th>

                    {isAdmin && (
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredTypes.map((type) => (
                    <tr
                      key={type.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-lg">
                            🐔
                          </div>

                          <div>
                            <div className="font-semibold text-slate-900">
                              {type.name}
                            </div>

                            <div className="text-xs text-slate-400">
                              Jenis ayam
                            </div>
                          </div>
                        </div>
                      </td>

                      {isSuperAdmin && (
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">
                            {type.farms?.name || 'Tidak diketahui'}
                          </div>

                          {type.farms?.farm_code && (
                            <div className="text-xs text-slate-400">
                              {type.farms.farm_code}
                            </div>
                          )}
                        </td>
                      )}

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {type.description || (
                          <span className="text-slate-400">
                            Tidak ada keterangan
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(type.created_at)}
                      </td>

                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(type)
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(type)
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </div>

          {/* MOBILE */}
          <div className="grid gap-4 md:hidden">
            {filteredTypes.map((type) => (
              <div
                key={type.id}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-3">

                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl">
                      🐔
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900">
                        {type.name}
                      </h3>

                      <p className="text-xs text-slate-400">
                        {formatDate(type.created_at)}
                      </p>
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      {type.farms?.farm_code ||
                        'Farm'}
                    </span>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Peternakan
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      {type.farms?.name ||
                        'Tidak diketahui'}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Keterangan
                  </div>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {type.description ||
                      'Tidak ada keterangan.'}
                  </p>
                </div>

                {isAdmin && (
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(type)
                      }
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(type)
                      }
                      className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingType
                      ? 'Edit Jenis Ayam'
                      : 'Tambah Jenis Ayam'}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {editingType
                      ? 'Perbarui informasi jenis ayam.'
                      : 'Tambahkan jenis ayam untuk peternakan ini.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >

              {/* FARM */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Peternakan
                </label>

                {isSuperAdmin ? (
                  <select
                    name="farm_id"
                    value={form.farm_id}
                    onChange={handleChange}
                    required
                    disabled={Boolean(editingType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100 disabled:bg-slate-100"
                  >
                    <option value="">
                      Pilih peternakan
                    </option>

                    {farms
                      .filter(
                        (item) =>
                          item.status === 'active'
                      )
                      .map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.farm_code
                            ? `${item.farm_code} - ${item.name}`
                            : item.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    {currentFarmName ||
                      'Peternakan saat ini'}
                  </div>
                )}
              </div>

              {/* NAME */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nama Jenis Ayam
                </label>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Contoh: Broiler"
                  required
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Keterangan
                  <span className="ml-1 font-normal text-slate-400">
                    (opsional)
                  </span>
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Contoh: Ayam pedaging untuk produksi..."
                  rows={4}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />
              </div>

              {/* ACTION */}
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? 'Menyimpan...'
                    : editingType
                      ? 'Simpan Perubahan'
                      : 'Tambah Jenis Ayam'}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================
// HELPER
// =========================================================

function formatDate(value) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default ChickenTypes