import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Inventory({ user }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    record_date: new Date().toISOString().split('T')[0],
    item_name: '',
    item_type: '',
    quantity: '',
    unit: 'pcs',
    minimum_stock: '',
    notes: '',
  })

  const itemTypes = [
    'Peralatan Kandang',
    'Peralatan Listrik',
    'Obat & Vitamin',
    'Perlengkapan',
    'Kebersihan',
    'Lainnya',
  ]

  const units = [
    'pcs',
    'unit',
    'botol',
    'dus',
    'liter',
    'kg',
    'sak',
    'set',
  ]

  const loadItems = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('record_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
        alert(`Gagal mengambil data stok barang.\n\n${error.message}`)
        return
      }

      setItems(data || [])
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan saat mengambil data stok barang.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const resetForm = () => {
    setForm({
      record_date: new Date().toISOString().split('T')[0],
      item_name: '',
      item_type: '',
      quantity: '',
      unit: 'pcs',
      minimum_stock: '',
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

    if (!form.item_name.trim()) {
      alert('Nama barang wajib diisi.')
      return
    }

    if (form.quantity === '' || Number(form.quantity) < 0) {
      alert('Jumlah stok tidak valid.')
      return
    }

    if (
      form.minimum_stock === '' ||
      Number(form.minimum_stock) < 0
    ) {
      alert('Minimum stok tidak valid.')
      return
    }

    try {
      setSaving(true)

      const payload = {
        record_date: form.record_date,
        item_name: form.item_name.trim(),
        item_type: form.item_type || null,
        quantity: Number(form.quantity),
        unit: form.unit,
        minimum_stock: Number(form.minimum_stock),
        notes: form.notes.trim() || null,
      }

      if (user?.id) {
        payload.created_by = user.id
      }

      let error = null

      if (editingId) {
        const result = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', editingId)

        error = result.error
      } else {
        const result = await supabase
          .from('inventory')
          .insert([payload])

        error = result.error
      }

      if (error) {
        console.error(error)

        alert(
          `Gagal menyimpan data stok barang.\n\n` +
          `Pesan: ${error.message}\n` +
          `Detail: ${error.details || '-'}\n` +
          `Hint: ${error.hint || '-'}\n` +
          `Code: ${error.code || '-'}`
        )

        return
      }

      alert(
        editingId
          ? 'Data stok barang berhasil diperbarui.'
          : 'Data stok barang berhasil ditambahkan.'
      )

      resetForm()
      setShowForm(false)
      await loadItems()
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan saat menyimpan data.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (item) => {
    setEditingId(item.id)

    setForm({
      record_date:
        item.record_date ||
        new Date().toISOString().split('T')[0],
      item_name: item.item_name || '',
      item_type: item.item_type || '',
      quantity:
        item.quantity !== null && item.quantity !== undefined
          ? String(item.quantity)
          : '',
      unit: item.unit || 'pcs',
      minimum_stock:
        item.minimum_stock !== null &&
        item.minimum_stock !== undefined
          ? String(item.minimum_stock)
          : '',
      notes: item.notes || '',
    })

    setShowForm(true)
  }

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      'Yakin ingin menghapus data stok barang ini?'
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)

      if (error) {
        console.error(error)
        alert(`Gagal menghapus data.\n\n${error.message}`)
        return
      }

      await loadItems()
    } catch (error) {
      console.error(error)
      alert('Terjadi kesalahan saat menghapus data.')
    }
  }

  const stats = useMemo(() => {
    const totalStock = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    )

    const totalMinimum = items.reduce(
      (sum, item) =>
        sum + Number(item.minimum_stock || 0),
      0
    )

    const safeStock = items.filter(
      (item) =>
        Number(item.quantity || 0) >
        Number(item.minimum_stock || 0)
    ).length

    const lowStock = items.filter(
      (item) =>
        Number(item.quantity || 0) <=
        Number(item.minimum_stock || 0)
    ).length

    return {
      totalStock,
      totalMinimum,
      safeStock,
      lowStock,
    }
  }, [items])

  const formatNumber = (value) => {
    return new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 2,
    }).format(Number(value || 0))
  }

  const formatDate = (date) => {
    if (!date) return '-'

    return new Date(`${date}T00:00:00`).toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    )
  }

  const getStockStatus = (item) => {
    const quantity = Number(item.quantity || 0)
    const minimum = Number(item.minimum_stock || 0)

    if (quantity <= minimum) {
      return {
        label: 'Stok Menipis',
        className:
          'bg-red-50 text-red-600 border-red-200',
      }
    }

    return {
      label: 'Aman',
      className:
        'bg-green-50 text-green-600 border-green-200',
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Stok Barang
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Kelola persediaan barang dan perlengkapan
            peternakan.
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
          Tambah Barang
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Stok
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatNumber(stats.totalStock)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
              📦
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Minimum Stok
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatNumber(stats.totalMinimum)}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-50 text-xl">
              ⚖️
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Stok Aman
              </p>

              <p className="mt-2 text-2xl font-bold text-green-600">
                {stats.safeStock}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
              ✓
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Stok Menipis
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {stats.lowStock}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl">
              ⚠️
            </div>
          </div>
        </div>

      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingId
                  ? 'Edit Stok Barang'
                  : 'Tambah Stok Barang'}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Masukkan informasi stok barang.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Tutup
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
          >

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tanggal
              </label>

              <input
                type="date"
                name="record_date"
                value={form.record_date}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nama Barang *
              </label>

              <input
                type="text"
                name="item_name"
                value={form.item_name}
                onChange={handleChange}
                placeholder="Contoh: Tempat Pakan"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Jenis Barang
              </label>

              <select
                name="item_type"
                value={form.item_type}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="">
                  Pilih jenis barang
                </option>

                {itemTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Jumlah Stok *
              </label>

              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Satuan
              </label>

              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Minimum Stok *
              </label>

              <input
                type="number"
                name="minimum_stock"
                value={form.minimum_stock}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Catatan
              </label>

              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Catatan tambahan..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

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
                    : 'Simpan Barang'}
              </button>

              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Batal
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Riwayat Stok Barang
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Daftar seluruh barang yang tercatat.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

            <p className="mt-3 text-sm text-slate-500">
              Memuat data...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl">📦</div>

            <h3 className="mt-3 font-semibold text-slate-900">
              Belum ada data barang
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Tambahkan stok barang pertama kamu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">

              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Tanggal
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Barang
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Jenis
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Stok
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Minimum
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Catatan
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {items.map((item) => {
                  const status = getStockStatus(item)

                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        {formatDate(item.record_date)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {item.item_name}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {item.item_type || '-'}
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">
                          {formatNumber(item.quantity)}
                        </span>

                        <span className="ml-1 text-sm text-slate-500">
                          {item.unit}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatNumber(item.minimum_stock)}{' '}
                        {item.unit}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="max-w-[220px] px-6 py-4 text-sm text-slate-500">
                        <div className="truncate">
                          {item.notes || '-'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">

                          <button
                            onClick={() => handleEdit(item)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(item.id)
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Hapus
                          </button>

                        </div>
                      </td>
                    </tr>
                  )
                })}

              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  )
}

export default Inventory