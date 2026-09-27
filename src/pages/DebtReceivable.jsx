import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function DebtReceivable({ user, defaultType = 'debt' }) {
  const [type, setType] = useState(defaultType)

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    amount: '',
    paid_amount: '',
    due_date: '',
  })

  /*
    ============================================================
    SINKRONISASI HUTANG / PIUTANG
    ============================================================
  */

  useEffect(() => {
    setType(defaultType)

    setShowForm(false)
    setEditingId(null)

    setForm({
      title: '',
      description: '',
      amount: '',
      paid_amount: '',
      due_date: '',
    })
  }, [defaultType])

  /*
    ============================================================
    KONFIGURASI DINAMIS
    ============================================================
  */

  const isDebt = type === 'debt'

  const tableName = isDebt
    ? 'debts'
    : 'receivables'

  const paymentField = isDebt
    ? 'paid_amount'
    : 'received_amount'

  const pageTitle = isDebt
    ? 'Hutang'
    : 'Piutang'

  const pageDescription = isDebt
    ? 'Kelola seluruh hutang peternakan'
    : 'Kelola seluruh piutang peternakan'

  const paymentLabel = isDebt
    ? 'Sudah Dibayar'
    : 'Sudah Diterima'

  const remainingLabel = isDebt
    ? 'Sisa Hutang'
    : 'Sisa Piutang'

  const statusPaidLabel = isDebt
    ? 'Lunas'
    : 'Lunas'

  /*
    ============================================================
    LOAD DATA
    ============================================================
  */

  const loadData = async () => {
    try {
      setLoading(true)

      const { data: result, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', {
          ascending: false,
        })

      if (error) {
        console.error(error)
        alert(
          `Gagal memuat data ${isDebt ? 'hutang' : 'piutang'}: ${error.message}`
        )
        return
      }

      setData(result || [])
    } catch (error) {
      console.error(error)

      alert(
        `Gagal memuat data ${isDebt ? 'hutang' : 'piutang'}.`
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [type])

  /*
    ============================================================
    FORM HANDLER
    ============================================================
  */

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      amount: '',
      paid_amount: '',
      due_date: '',
    })

    setEditingId(null)
    setShowForm(false)
  }

  /*
    ============================================================
    STATUS
    ============================================================
  */

  const calculateStatus = (
    amount,
    paymentAmount
  ) => {
    const total = Number(amount || 0)
    const paid = Number(paymentAmount || 0)

    if (paid >= total && total > 0) {
      return 'paid'
    }

    if (paid > 0) {
      return 'partial'
    }

    return 'unpaid'
  }

  /*
    ============================================================
    SIMPAN DATA
    ============================================================
  */

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.title.trim()) {
      alert(
        `Nama ${isDebt ? 'hutang' : 'piutang'} wajib diisi.`
      )
      return
    }

    if (!form.amount || Number(form.amount) <= 0) {
      alert('Jumlah harus lebih dari 0.')
      return
    }

    const amount = Number(form.amount)

    const paymentAmount = Number(
      form.paid_amount || 0
    )

    if (paymentAmount < 0) {
      alert(
        `${paymentLabel} tidak boleh kurang dari 0.`
      )
      return
    }

    if (paymentAmount > amount) {
      alert(
        `${paymentLabel} tidak boleh lebih besar dari jumlah total.`
      )
      return
    }

    const status = calculateStatus(
      amount,
      paymentAmount
    )

    try {
      setSaving(true)

      /*
        ========================================================
        PENTING:
        Hutang     -> paid_amount
        Piutang    -> received_amount
        ========================================================
      */

      const payload = {
        title: form.title.trim(),
        description:
          form.description.trim() || null,
        amount,
        [paymentField]: paymentAmount,
        due_date: form.due_date || null,
        status,
      }

      /*
        Tambahkan created_by hanya ketika membuat data baru
      */

      if (!editingId && user?.id) {
        payload.created_by = user.id
      }

      let error = null

      if (editingId) {
        const result = await supabase
          .from(tableName)
          .update(payload)
          .eq('id', editingId)

        error = result.error
      } else {
        const result = await supabase
          .from(tableName)
          .insert([payload])

        error = result.error
      }

      if (error) {
        console.error(error)

        alert(
          `Gagal menyimpan data ${isDebt ? 'hutang' : 'piutang'}: ${error.message}`
        )

        return
      }

      alert(
        `Data ${isDebt ? 'hutang' : 'piutang'} berhasil ${
          editingId ? 'diperbarui' : 'disimpan'
        }.`
      )

      resetForm()

      await loadData()
    } catch (error) {
      console.error(error)

      alert(
        `Gagal menyimpan data ${isDebt ? 'hutang' : 'piutang'}.`
      )
    } finally {
      setSaving(false)
    }
  }

  /*
    ============================================================
    EDIT DATA
    ============================================================
  */

  const handleEdit = (item) => {
    setEditingId(item.id)

    setForm({
      title: item.title || '',
      description: item.description || '',
      amount:
        item.amount !== null &&
        item.amount !== undefined
          ? String(item.amount)
          : '',
      paid_amount:
        item[paymentField] !== null &&
        item[paymentField] !== undefined
          ? String(item[paymentField])
          : '',
      due_date: item.due_date || '',
    })

    setShowForm(true)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  /*
    ============================================================
    HAPUS DATA
    ============================================================
  */

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      `Yakin ingin menghapus data ${isDebt ? 'hutang' : 'piutang'} ini?`
    )

    if (!confirmDelete) {
      return
    }

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)

      if (error) {
        console.error(error)

        alert(
          `Gagal menghapus data ${isDebt ? 'hutang' : 'piutang'}: ${error.message}`
        )

        return
      }

      await loadData()

      alert(
        `Data ${isDebt ? 'hutang' : 'piutang'} berhasil dihapus.`
      )
    } catch (error) {
      console.error(error)

      alert(
        `Gagal menghapus data ${isDebt ? 'hutang' : 'piutang'}.`
      )
    }
  }

  /*
    ============================================================
    FORMAT RUPIAH
    ============================================================
  */

  const formatRupiah = (value) => {
    return new Intl.NumberFormat(
      'id-ID',
      {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }
    ).format(Number(value || 0))
  }

  /*
    ============================================================
    FORMAT TANGGAL
    ============================================================
  */

  const formatDate = (date) => {
    if (!date) {
      return '-'
    }

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    )
  }

  /*
    ============================================================
    STATISTIK
    ============================================================
  */

  const stats = useMemo(() => {
    const total = data.reduce(
      (sum, item) =>
        sum + Number(item.amount || 0),
      0
    )

    const paid = data.reduce(
      (sum, item) =>
        sum +
        Number(
          item[paymentField] || 0
        ),
      0
    )

    const remaining = Math.max(
      total - paid,
      0
    )

    const unpaidCount = data.filter(
      (item) => item.status === 'unpaid'
    ).length

    const partialCount = data.filter(
      (item) => item.status === 'partial'
    ).length

    const paidCount = data.filter(
      (item) => item.status === 'paid'
    ).length

    return {
      total,
      paid,
      remaining,
      unpaidCount,
      partialCount,
      paidCount,
    }
  }, [data, paymentField])

  /*
    ============================================================
    STATUS BADGE
    ============================================================
  */

  const getStatusBadge = (status) => {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          {statusPaidLabel}
        </span>
      )
    }

    if (status === 'partial') {
      return (
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
          Sebagian
        </span>
      )
    }

    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Belum Dibayar
      </span>
    )
  }

  /*
    ============================================================
    CEK JATUH TEMPO
    ============================================================
  */

  const isOverdue = (item) => {
    if (!item.due_date) {
      return false
    }

    if (item.status === 'paid') {
      return false
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dueDate = new Date(
      `${item.due_date}T00:00:00`
    )

    return dueDate < today
  }

  /*
    ============================================================
    RENDER
    ============================================================
  */

  return (
    <div className="space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {pageTitle}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {pageDescription}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm()
            } else {
              setShowForm(true)
            }
          }}
          className="inline-flex items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
        >
          {showForm
            ? 'Tutup Form'
            : `+ Tambah ${pageTitle}`}
        </button>

      </div>

      {/* ======================================================
          STATISTIK
      ====================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total {pageTitle}
              </p>

              <h3 className="mt-2 text-xl font-bold text-slate-900">
                {formatRupiah(stats.total)}
              </h3>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl">
              💰
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                {paymentLabel}
              </p>

              <h3 className="mt-2 text-xl font-bold text-green-600">
                {formatRupiah(stats.paid)}
              </h3>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
              ✓
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                {remainingLabel}
              </p>

              <h3 className="mt-2 text-xl font-bold text-orange-600">
                {formatRupiah(stats.remaining)}
              </h3>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-xl">
              ⏳
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Belum Lunas
              </p>

              <h3 className="mt-2 text-xl font-bold text-red-600">
                {stats.unpaidCount + stats.partialCount}
              </h3>

              <p className="mt-1 text-xs text-slate-400">
                {stats.partialCount} sebagian
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl">
              ⚠️
            </div>
          </div>
        </div>

      </div>

      {/* ======================================================
          FORM
      ====================================================== */}

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">
              {editingId
                ? `Edit ${pageTitle}`
                : `Tambah ${pageTitle}`}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Isi data {pageTitle.toLowerCase()} dengan lengkap.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              {/* Nama */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nama {pageTitle}
                </label>

                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder={`Contoh: ${isDebt ? 'Hutang pakan' : 'Piutang pelanggan'}`}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* Jumlah */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Jumlah Total
                </label>

                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="0"
                  placeholder="Contoh: 2500000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* Sudah dibayar / diterima */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {paymentLabel}
                </label>

                <input
                  type="number"
                  name="paid_amount"
                  value={form.paid_amount}
                  onChange={handleChange}
                  min="0"
                  placeholder="Contoh: 1000000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />

                <p className="mt-1 text-xs text-slate-400">
                  {isDebt
                    ? 'Jumlah yang sudah dibayarkan.'
                    : 'Jumlah yang sudah diterima.'}
                </p>
              </div>

              {/* Jatuh tempo */}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Jatuh Tempo
                </label>

                <input
                  type="date"
                  name="due_date"
                  value={form.due_date}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

            </div>

            {/* Deskripsi */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Keterangan
              </label>

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows="4"
                placeholder="Tambahkan keterangan jika diperlukan..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* Tombol */}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? 'Menyimpan...'
                  : editingId
                    ? `Update ${pageTitle}`
                    : `Simpan ${pageTitle}`}
              </button>

            </div>

          </form>
        </div>
      )}

      {/* ======================================================
          TABLE
      ====================================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-6 py-5">

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Riwayat {pageTitle}
              </h2>

              <p className="text-sm text-slate-500">
                Daftar seluruh data {pageTitle.toLowerCase()}.
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              {data.length} Data
            </div>

          </div>

        </div>

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="text-center">

              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

              <p className="text-sm text-slate-500">
                Memuat data...
              </p>

            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex min-h-[220px] items-center justify-center px-6">
            <div className="text-center">

              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                📋
              </div>

              <h3 className="font-semibold text-slate-900">
                Belum ada data {pageTitle}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Tambahkan data pertama kamu menggunakan tombol di atas.
              </p>

            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="min-w-[1000px] w-full">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    {pageTitle}
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    {paymentLabel}
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Sisa
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Jatuh Tempo
                  </th>

                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                    Aksi
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {data.map((item) => {
                  const total =
                    Number(item.amount || 0)

                  const payment =
                    Number(
                      item[paymentField] || 0
                    )

                  const remaining =
                    Math.max(
                      total - payment,
                      0
                    )

                  const overdue =
                    isOverdue(item)

                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50"
                    >

                      {/* Nama */}

                      <td className="px-6 py-4">

                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.title}
                          </p>

                          {item.description && (
                            <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                              {item.description}
                            </p>
                          )}

                        </div>

                      </td>

                      {/* Total */}

                      <td className="px-6 py-4">

                        <span className="font-semibold text-slate-900">
                          {formatRupiah(total)}
                        </span>

                      </td>

                      {/* Payment */}

                      <td className="px-6 py-4">

                        <span className="font-semibold text-green-600">
                          {formatRupiah(payment)}
                        </span>

                      </td>

                      {/* Remaining */}

                      <td className="px-6 py-4">

                        <span
                          className={`font-semibold ${
                            remaining > 0
                              ? 'text-orange-600'
                              : 'text-green-600'
                          }`}
                        >
                          {formatRupiah(remaining)}
                        </span>

                      </td>

                      {/* Due date */}

                      <td className="px-6 py-4">

                        <div>
                          <p
                            className={`text-sm font-medium ${
                              overdue
                                ? 'text-red-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {formatDate(
                              item.due_date
                            )}
                          </p>

                          {overdue && (
                            <p className="mt-1 text-xs font-semibold text-red-500">
                              Terlambat
                            </p>
                          )}
                        </div>

                      </td>

                      {/* Status */}

                      <td className="px-6 py-4">
                        {getStatusBadge(
                          item.status
                        )}
                      </td>

                      {/* Aksi */}

                      <td className="px-6 py-4">

                        <div className="flex justify-end gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              handleEdit(item)
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
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

export default DebtReceivable