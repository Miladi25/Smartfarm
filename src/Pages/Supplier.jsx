import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Supplier({ user }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    supplier_type: '',
    notes: '',
  })

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      setError('')

      const { data, error: supabaseError } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false })

      if (supabaseError) {
        console.error(supabaseError)
        setError('Gagal memuat data supplier.')
        return
      }

      setSuppliers(data || [])
    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan saat memuat supplier.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      address: '',
      supplier_type: '',
      notes: '',
    })

    setEditingId(null)
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name.trim()) {
      setError('Nama supplier wajib diisi.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        supplier_type: form.supplier_type.trim() || null,
        notes: form.notes.trim() || null,
      }

      if (!editingId && user?.id) {
        payload.created_by = user.id
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', editingId)

        if (updateError) {
          console.error(updateError)
          setError(
            `Gagal memperbarui supplier: ${updateError.message}`
          )
          return
        }
      } else {
        const { error: insertError } = await supabase
          .from('suppliers')
          .insert(payload)

        if (insertError) {
          console.error(insertError)
          setError(
            `Gagal menambahkan supplier: ${insertError.message}`
          )
          return
        }
      }

      resetForm()
      setShowForm(false)
      await loadSuppliers()
    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan saat menyimpan data.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (supplier) => {
    setForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      supplier_type: supplier.supplier_type || '',
      notes: supplier.notes || '',
    })

    setEditingId(supplier.id)
    setShowForm(true)
    setError('')
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      'Yakin ingin menghapus supplier ini?'
    )

    if (!confirmed) return

    try {
      setError('')

      const { error: deleteError } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error(deleteError)
        setError(
          `Gagal menghapus supplier: ${deleteError.message}`
        )
        return
      }

      await loadSuppliers()
    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan saat menghapus supplier.')
    }
  }

  const filteredSuppliers = useMemo(() => {
    const keyword = search.toLowerCase().trim()

    if (!keyword) return suppliers

    return suppliers.filter((supplier) =>
      [
        supplier.name,
        supplier.phone,
        supplier.address,
        supplier.supplier_type,
        supplier.notes,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(keyword)
        )
    )
  }, [suppliers, search])

  const totalSupplier = suppliers.length

  const totalPakan = suppliers.filter(
    (supplier) =>
      supplier.supplier_type?.toLowerCase() === 'pakan'
  ).length

  const totalObat = suppliers.filter(
    (supplier) =>
      supplier.supplier_type?.toLowerCase() ===
      'obat & vitamin'
  ).length

  const totalLainnya =
    totalSupplier - totalPakan - totalObat

  const formatDate = (date) => {
    if (!date) return '-'

    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getInitial = (name) => {
    if (!name) return 'S'

    return name
      .trim()
      .charAt(0)
      .toUpperCase()
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-red-600">
            Data Peternakan
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Supplier
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Kelola data supplier yang bekerja sama dengan peternakan.
          </p>
        </div>

        <button
          onClick={() => {
            if (showForm) {
              resetForm()
              setShowForm(false)
              setError('')
            } else {
              resetForm()
              setShowForm(true)
              setError('')
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
        >
          <span className="text-lg">
            {showForm ? '×' : '+'}
          </span>

          {showForm ? 'Tutup Form' : 'Tambah Supplier'}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              {editingId
                ? 'Edit Supplier'
                : 'Tambah Supplier Baru'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Isi informasi supplier dengan lengkap.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
          >
            {/* NAMA */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Nama Supplier *
              </label>

              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Contoh: CV Pakan Makmur"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* TELEPON */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Nomor Telepon
              </label>

              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Contoh: 081234567890"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* JENIS */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Jenis Supplier
              </label>

              <select
                name="supplier_type"
                value={form.supplier_type}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100"
              >
                <option value="">
                  Pilih jenis supplier
                </option>
                <option value="Pakan">Pakan</option>
                <option value="Obat & Vitamin">
                  Obat & Vitamin
                </option>
                <option value="Peralatan">
                  Peralatan
                </option>
                <option value="Telur">Telur</option>
                <option value="Ayam">Ayam</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            {/* ALAMAT */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Alamat
              </label>

              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Contoh: Pamekasan"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* CATATAN */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Catatan
              </label>

              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Catatan tambahan mengenai supplier..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* BUTTON */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? 'Menyimpan...'
                  : editingId
                    ? 'Simpan Perubahan'
                    : 'Simpan Supplier'}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                  setError('')
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Supplier
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {totalSupplier}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl">
              🚚
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Supplier Pakan
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {totalPakan}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-xl">
              🌾
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Obat & Vitamin
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {totalObat}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
              💊
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Supplier Lainnya
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {totalLainnya}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
              📦
            </div>
          </div>
        </div>

      </div>

      {/* TABLE CARD */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* TABLE HEADER */}
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Daftar Supplier
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Data supplier yang tersimpan dalam sistem.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari supplier..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100"
            />
          </div>

        </div>

        {/* LOADING */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

              <p className="text-sm text-slate-500">
                Memuat data supplier...
              </p>
            </div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
              🚚
            </div>

            <h3 className="mt-4 text-base font-bold text-slate-900">
              {search
                ? 'Supplier tidak ditemukan'
                : 'Belum ada supplier'}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {search
                ? 'Coba gunakan kata kunci pencarian lain.'
                : 'Tambahkan supplier pertama untuk mulai mengelola data.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">

              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Supplier
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Telepon
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Jenis
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Alamat
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dibuat
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/70"
                  >

                    {/* SUPPLIER */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 font-bold text-red-600">
                          {getInitial(supplier.name)}
                        </div>

                        <div>
                          <p className="font-semibold text-slate-900">
                            {supplier.name}
                          </p>

                          {supplier.notes && (
                            <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                              {supplier.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* TELEPON */}
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {supplier.phone || '-'}
                    </td>

                    {/* JENIS */}
                    <td className="px-5 py-4">
                      {supplier.supplier_type ? (
                        <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                          {supplier.supplier_type}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">
                          -
                        </span>
                      )}
                    </td>

                    {/* ALAMAT */}
                    <td className="max-w-xs px-5 py-4 text-sm text-slate-600">
                      <div className="truncate">
                        {supplier.address || '-'}
                      </div>
                    </td>

                    {/* CREATED */}
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDate(supplier.created_at)}
                    </td>

                    {/* ACTION */}
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">

                        <button
                          onClick={() => handleEdit(supplier)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(supplier.id)
                          }
                          className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Hapus
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}

        {/* FOOTER */}
        {!loading && filteredSuppliers.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-sm text-slate-500">
              Menampilkan{' '}
              <span className="font-semibold text-slate-700">
                {filteredSuppliers.length}
              </span>{' '}
              dari{' '}
              <span className="font-semibold text-slate-700">
                {suppliers.length}
              </span>{' '}
              supplier
            </p>
          </div>
        )}

      </div>

    </div>
  )
}

export default Supplier