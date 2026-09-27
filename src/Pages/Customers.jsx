import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Customers({ user }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    customer_type: '',
    notes: '',
  })

  const loadCustomers = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        alert('Gagal mengambil data pelanggan.')
        return
      }

      setCustomers(data || [])
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan saat mengambil data pelanggan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const resetForm = () => {
    setForm({
      name: '',
      phone: '',
      address: '',
      customer_type: '',
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
      alert('Nama pelanggan wajib diisi.')
      return
    }

    try {
      setSaving(true)

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        customer_type: form.customer_type.trim() || null,
        notes: form.notes.trim() || null,
      }

      if (editingId) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingId)

        if (error) {
          console.error(error)
          alert('Gagal memperbarui data pelanggan.')
          return
        }

        alert('Data pelanggan berhasil diperbarui.')
      } else {
        const insertPayload = {
          ...payload,
          created_by: user?.id || null,
        }

        const { error } = await supabase
          .from('customers')
          .insert([insertPayload])

        if (error) {
          console.error(error)
          alert('Gagal menyimpan data pelanggan.')
          return
        }

        alert('Pelanggan berhasil ditambahkan.')
      }

      resetForm()
      setShowForm(false)
      await loadCustomers()
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan saat menyimpan data pelanggan.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (customer) => {
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      customer_type: customer.customer_type || '',
      notes: customer.notes || '',
    })

    setEditingId(customer.id)
    setShowForm(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      'Yakin ingin menghapus pelanggan ini?'
    )

    if (!confirmed) return

    try {
      setDeletingId(id)

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) {
        console.error(error)
        alert('Gagal menghapus pelanggan.')
        return
      }

      alert('Pelanggan berhasil dihapus.')
      await loadCustomers()
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan saat menghapus pelanggan.')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) {
      return customers
    }

    return customers.filter((customer) => {
      const name = customer.name?.toLowerCase() || ''
      const phone = customer.phone?.toLowerCase() || ''
      const address = customer.address?.toLowerCase() || ''
      const type = customer.customer_type?.toLowerCase() || ''
      const notes = customer.notes?.toLowerCase() || ''

      return (
        name.includes(keyword) ||
        phone.includes(keyword) ||
        address.includes(keyword) ||
        type.includes(keyword) ||
        notes.includes(keyword)
      )
    })
  }, [customers, search])

  const totalCustomers = customers.length

  const totalToko = customers.filter(
    (customer) =>
      customer.customer_type?.toLowerCase() === 'toko'
  ).length

  const totalIndividu = customers.filter(
    (customer) =>
      customer.customer_type?.toLowerCase() === 'individu'
  ).length

  const totalLainnya =
    totalCustomers - totalToko - totalIndividu

  const formatDate = (date) => {
    if (!date) return '-'

    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-600">
              Data Pelanggan
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">
              Pelanggan
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Kelola data pelanggan peternakan dengan mudah.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            <span className="text-lg">+</span>
            Tambah Pelanggan
          </button>
        </div>

        {/* STATISTIK */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Total Pelanggan
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {totalCustomers}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-2xl">
                👥
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Pelanggan Toko
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {totalToko}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                🏪
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Pelanggan Individu
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {totalIndividu}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                👤
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Jenis Lainnya
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {totalLainnya}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                📋
              </div>
            </div>
          </div>

        </div>

        {/* FORM */}
        {showForm && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? 'Edit Pelanggan'
                    : 'Tambah Pelanggan'}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Lengkapi informasi pelanggan.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-5 md:grid-cols-2"
            >
              {/* NAMA */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nama Pelanggan *
                </label>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Contoh: Toko Ayam Sejahtera"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* JENIS */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Jenis Pelanggan
                </label>

                <select
                  name="customer_type"
                  value={form.customer_type}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                >
                  <option value="">
                    Pilih jenis pelanggan
                  </option>

                  <option value="Toko">
                    Toko
                  </option>

                  <option value="Individu">
                    Individu
                  </option>

                  <option value="Distributor">
                    Distributor
                  </option>

                  <option value="Reseller">
                    Reseller
                  </option>

                  <option value="Lainnya">
                    Lainnya
                  </option>
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                  placeholder="Catatan tambahan tentang pelanggan..."
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* BUTTON */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row md:col-span-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setShowForm(false)
                  }}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? 'Menyimpan...'
                    : editingId
                    ? 'Simpan Perubahan'
                    : 'Simpan Pelanggan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SEARCH */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>
              <h2 className="font-bold text-slate-900">
                Daftar Pelanggan
              </h2>

              <p className="text-sm text-slate-500">
                {filteredCustomers.length} pelanggan ditemukan
              </p>
            </div>

            <div className="relative w-full md:max-w-sm">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                🔎
              </span>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, telepon, alamat..."
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-[250px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600"></div>

                <p className="text-sm text-slate-500">
                  Memuat data pelanggan...
                </p>
              </div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex min-h-[250px] items-center justify-center p-6">
              <div className="text-center">
                <div className="mb-3 text-5xl">
                  👥
                </div>

                <h3 className="font-bold text-slate-900">
                  Belum ada pelanggan
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Tambahkan pelanggan untuk mulai mengelola data.
                </p>

                <button
                  onClick={() => {
                    resetForm()
                    setShowForm(true)
                  }}
                  className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  + Tambah Pelanggan
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                      Pelanggan
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
                  {filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      {/* NAMA */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 font-bold text-red-600">
                            {customer.name
                              ?.charAt(0)
                              ?.toUpperCase() || '?'}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">
                              {customer.name}
                            </p>

                            {customer.notes && (
                              <p className="mt-1 max-w-[220px] truncate text-xs text-slate-400">
                                {customer.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* TELEPON */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-700">
                          {customer.phone || '-'}
                        </span>
                      </td>

                      {/* JENIS */}
                      <td className="px-5 py-4">
                        {customer.customer_type ? (
                          <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                            {customer.customer_type}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      {/* ALAMAT */}
                      <td className="max-w-[220px] px-5 py-4">
                        <span className="block truncate text-sm text-slate-700">
                          {customer.address || '-'}
                        </span>
                      </td>

                      {/* CREATED */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-600">
                          {formatDate(customer.created_at)}
                        </span>
                      </td>

                      {/* AKSI */}
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              handleEdit(customer)
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(customer.id)
                            }
                            disabled={
                              deletingId === customer.id
                            }
                            className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === customer.id
                              ? '...'
                              : 'Hapus'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FOOTER INFO */}
        {!loading && customers.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              Menampilkan {filteredCustomers.length} dari{' '}
              {customers.length} pelanggan
            </span>

            <button
              onClick={loadCustomers}
              className="font-semibold text-red-600 transition hover:text-red-700"
            >
              ↻ Refresh Data
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default Customers