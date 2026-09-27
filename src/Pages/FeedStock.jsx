import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function FeedStock({ user }) {
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    record_date: new Date().toISOString().split('T')[0],
    feed_name: '',
    feed_type: '',
    quantity: '',
    unit: 'kg',
    minimum_stock: '',
    notes: '',
  })

  const loadStocks = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('feed_stock')
        .select('*')
        .order('record_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      setStocks(data || [])
    } catch (error) {
      console.error(error)
      alert(
        `Gagal mengambil data stok pakan.\n\n${error.message || 'Terjadi kesalahan.'}`
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStocks()
  }, [])

  const resetForm = () => {
    setForm({
      record_date: new Date().toISOString().split('T')[0],
      feed_name: '',
      feed_type: '',
      quantity: '',
      unit: 'kg',
      minimum_stock: '',
      notes: '',
    })

    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.feed_name.trim()) {
      alert('Nama pakan wajib diisi.')
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
        feed_name: form.feed_name.trim(),
        feed_type: form.feed_type.trim() || null,
        quantity: Number(form.quantity),
        unit: form.unit,
        minimum_stock: Number(form.minimum_stock),
        notes: form.notes.trim() || null,
      }

      if (user?.id) {
        payload.created_by = user.id
      }

      if (editingId) {
        const { error } = await supabase
          .from('feed_stock')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error

        alert('Data stok pakan berhasil diperbarui.')
      } else {
        const { error } = await supabase
          .from('feed_stock')
          .insert([payload])

        if (error) throw error

        alert('Data stok pakan berhasil ditambahkan.')
      }

      resetForm()
      setShowForm(false)
      await loadStocks()
    } catch (error) {
      console.error(error)

      alert(
        `Gagal menyimpan data stok pakan.\n\n` +
        `Pesan: ${error.message || '-'}\n` +
        `Detail: ${error.details || '-'}\n` +
        `Hint: ${error.hint || '-'}\n` +
        `Code: ${error.code || '-'}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (stock) => {
    setForm({
      record_date:
        stock.record_date ||
        new Date().toISOString().split('T')[0],
      feed_name: stock.feed_name || '',
      feed_type: stock.feed_type || '',
      quantity: stock.quantity ?? '',
      unit: stock.unit || 'kg',
      minimum_stock: stock.minimum_stock ?? '',
      notes: stock.notes || '',
    })

    setEditingId(stock.id)
    setShowForm(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      'Yakin ingin menghapus data stok pakan ini?'
    )

    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('feed_stock')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadStocks()
    } catch (error) {
      console.error(error)

      alert(
        `Gagal menghapus data.\n\n${error.message || 'Terjadi kesalahan.'}`
      )
    }
  }

  const stats = useMemo(() => {
    const totalStock = stocks.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    )

    const totalMinimum = stocks.reduce(
      (sum, item) => sum + Number(item.minimum_stock || 0),
      0
    )

    const lowStock = stocks.filter(
      (item) =>
        Number(item.quantity || 0) <=
        Number(item.minimum_stock || 0)
    ).length

    const normalStock = stocks.filter(
      (item) =>
        Number(item.quantity || 0) >
        Number(item.minimum_stock || 0)
    ).length

    return {
      totalStock,
      totalMinimum,
      lowStock,
      normalStock,
    }
  }, [stocks])

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

  const getStockStatus = (stock) => {
    const quantity = Number(stock.quantity || 0)
    const minimum = Number(stock.minimum_stock || 0)

    if (quantity <= minimum) {
      return {
        label: 'Stok Menipis',
        className:
          'bg-red-50 text-red-600 border-red-100',
      }
    }

    return {
      label: 'Aman',
      className:
        'bg-emerald-50 text-emerald-600 border-emerald-100',
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
              INVENTARIS
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
            Stok Pakan
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Kelola dan pantau persediaan pakan ayam.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm()
            setShowForm(!showForm)
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
        >
          <span className="text-lg">+</span>
          {showForm ? 'Tutup Form' : 'Tambah Stok'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Stok
              </p>

              <h3 className="mt-2 text-2xl font-black text-slate-900">
                {formatNumber(stats.totalStock)}
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                Akumulasi seluruh pakan
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-3 text-xl">
              🌾
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Minimum Stok
              </p>

              <h3 className="mt-2 text-2xl font-black text-slate-900">
                {formatNumber(stats.totalMinimum)}
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                Batas minimum persediaan
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-3 text-xl">
              📦
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Stok Aman
              </p>

              <h3 className="mt-2 text-2xl font-black text-emerald-600">
                {stats.normalStock}
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                Jenis pakan dalam kondisi aman
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-3 text-xl">
              ✓
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Stok Menipis
              </p>

              <h3 className="mt-2 text-2xl font-black text-red-600">
                {stats.lowStock}
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                Perlu segera diperhatikan
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-3 text-xl">
              ⚠️
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-black text-slate-900">
              {editingId
                ? 'Edit Stok Pakan'
                : 'Tambah Stok Pakan'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Masukkan data persediaan pakan ayam.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Tanggal
              </label>

              <input
                type="date"
                value={form.record_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    record_date: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Nama Pakan
              </label>

              <input
                type="text"
                placeholder="Contoh: Pakan Starter"
                value={form.feed_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    feed_name: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Jenis Pakan
              </label>

              <select
                value={form.feed_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    feed_type: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white"
              >
                <option value="">Pilih jenis</option>
                <option value="Starter">Starter</option>
                <option value="Grower">Grower</option>
                <option value="Layer">Layer</option>
                <option value="Finisher">Finisher</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Jumlah Stok
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Contoh: 500"
                value={form.quantity}
                onChange={(e) =>
                  setForm({
                    ...form,
                    quantity: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Satuan
              </label>

              <select
                value={form.unit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    unit: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="sak">Sak</option>
                <option value="ton">Ton</option>
                <option value="liter">Liter</option>
                <option value="pcs">Pcs</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Minimum Stok
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Contoh: 100"
                value={form.minimum_stock}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minimum_stock: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Catatan
              </label>

              <textarea
                rows="3"
                placeholder="Catatan tambahan..."
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row md:col-span-2 md:justify-end">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? 'Menyimpan...'
                  : editingId
                    ? 'Simpan Perubahan'
                    : 'Simpan Stok'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-5 md:px-6">
          <h2 className="text-lg font-black text-slate-900">
            Riwayat Stok Pakan
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Daftar persediaan pakan yang tercatat.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center px-6 py-16">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />
              <p className="text-sm text-slate-500">
                Memuat data...
              </p>
            </div>
          </div>
        ) : stocks.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mb-3 text-4xl">🌾</div>

            <h3 className="font-bold text-slate-800">
              Belum ada data stok
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Tambahkan stok pakan pertama kamu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500">
                    Tanggal
                  </th>

                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500">
                    Pakan
                  </th>

                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500">
                    Jenis
                  </th>

                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500">
                    Stok
                  </th>

                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500">
                    Minimum
                  </th>

                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {stocks.map((stock) => {
                  const status = getStockStatus(stock)

                  return (
                    <tr
                      key={stock.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(stock.record_date)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {stock.feed_name}
                        </div>

                        {stock.notes && (
                          <div className="mt-1 max-w-xs truncate text-xs text-slate-400">
                            {stock.notes}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {stock.feed_type || '-'}
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-black text-slate-900">
                          {formatNumber(stock.quantity)}
                        </span>{' '}
                        <span className="text-sm text-slate-400">
                          {stock.unit}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                        {formatNumber(stock.minimum_stock)}{' '}
                        {stock.unit}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(stock)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(stock.id)
                            }
                            className="rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
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

export default FeedStock