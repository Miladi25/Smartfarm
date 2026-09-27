import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Production({ user, farm }) {
  const [records, setRecords] = useState([])
  const [chickenTypes, setChickenTypes] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)

  const [form, setForm] = useState({
    record_date: new Date().toISOString().split('T')[0],
    chicken_type_id: '',
    total_eggs: 0,
    good_eggs: 0,
    broken_eggs: 0,
    rejected_eggs: 0,
    notes: '',
  })

  const isSuperAdmin = user?.is_super_admin === true
  const currentFarmId = farm?.farmId || user?.farm_id || null

  // =========================================================
  // LOAD CHICKEN TYPES
  // =========================================================

  const loadChickenTypes = async () => {
    try {
      let query = supabase
        .from('chicken_types')
        .select('id, name, description, farm_id')
        .order('name', { ascending: true })

      if (!isSuperAdmin && currentFarmId) {
        query = query.eq('farm_id', currentFarmId)
      }

      const { data, error } = await query

      if (error) throw error

      setChickenTypes(data || [])
    } catch (error) {
      console.error('Gagal mengambil jenis ayam:', error)
      setChickenTypes([])
    }
  }

  // =========================================================
  // LOAD PRODUCTION
  // =========================================================

  const loadRecords = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('egg_production')
        .select(`
          id,
          record_date,
          total_eggs,
          good_eggs,
          broken_eggs,
          rejected_eggs,
          notes,
          created_by,
          created_at,
          chicken_type_id,
          farm_id,
          chicken_types (
            id,
            name
          )
        `)
        .order('record_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (!isSuperAdmin && currentFarmId) {
        query = query.eq('farm_id', currentFarmId)
      }

      const { data, error } = await query

      if (error) throw error

      setRecords(data || [])
    } catch (error) {
      console.error('Gagal mengambil data produksi telur:', error)

      alert(
        `Gagal mengambil data produksi telur: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    await Promise.all([
      loadChickenTypes(),
      loadRecords(),
    ])
  }

  useEffect(() => {
    loadData()
  }, [
    user?.id,
    user?.farm_id,
    user?.is_super_admin,
    farm?.farmId,
  ])

  // =========================================================
  // HELPERS
  // =========================================================

  const formatNumber = (number) => {
    return new Intl.NumberFormat('id-ID').format(
      Number(number || 0)
    )
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

  const calculateQualityTotal = (record) => {
    return (
      Number(record.good_eggs || 0) +
      Number(record.broken_eggs || 0) +
      Number(record.rejected_eggs || 0)
    )
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return records.filter((record) => {
      const chickenName =
        record.chicken_types?.name?.toLowerCase() || ''

      const notes =
        record.notes?.toLowerCase() || ''

      const matchesSearch =
        !keyword ||
        chickenName.includes(keyword) ||
        notes.includes(keyword)

      const matchesType =
        filterType === 'all' ||
        record.chicken_type_id === filterType

      return matchesSearch && matchesType
    })
  }, [records, search, filterType])

  // =========================================================
  // SUMMARY
  // =========================================================

  const summary = useMemo(() => {
    const totalEggs = records.reduce(
      (sum, record) =>
        sum + Number(record.total_eggs || 0),
      0
    )

    const goodEggs = records.reduce(
      (sum, record) =>
        sum + Number(record.good_eggs || 0),
      0
    )

    const brokenEggs = records.reduce(
      (sum, record) =>
        sum + Number(record.broken_eggs || 0),
      0
    )

    const rejectedEggs = records.reduce(
      (sum, record) =>
        sum + Number(record.rejected_eggs || 0),
      0
    )

    const qualityTotal =
      goodEggs + brokenEggs + rejectedEggs

    const goodPercentage =
      qualityTotal > 0
        ? (goodEggs / qualityTotal) * 100
        : 0

    return {
      totalEggs,
      goodEggs,
      brokenEggs,
      rejectedEggs,
      qualityTotal,
      goodPercentage,
    }
  }, [records])

  // =========================================================
  // SUMMARY BY CHICKEN TYPE
  // =========================================================

  const productionByType = useMemo(() => {
    const grouped = {}

    records.forEach((record) => {
      const typeId =
        record.chicken_type_id || 'unknown'

      const typeName =
        record.chicken_types?.name ||
        'Tanpa Jenis Ayam'

      if (!grouped[typeId]) {
        grouped[typeId] = {
          id: typeId,
          name: typeName,
          totalEggs: 0,
          goodEggs: 0,
          brokenEggs: 0,
          rejectedEggs: 0,
          recordCount: 0,
        }
      }

      grouped[typeId].totalEggs +=
        Number(record.total_eggs || 0)

      grouped[typeId].goodEggs +=
        Number(record.good_eggs || 0)

      grouped[typeId].brokenEggs +=
        Number(record.broken_eggs || 0)

      grouped[typeId].rejectedEggs +=
        Number(record.rejected_eggs || 0)

      grouped[typeId].recordCount += 1
    })

    return Object.values(grouped)
      .map((item) => {
        const qualityTotal =
          item.goodEggs +
          item.brokenEggs +
          item.rejectedEggs

        return {
          ...item,
          goodPercentage:
            qualityTotal > 0
              ? (item.goodEggs / qualityTotal) * 100
              : 0,
        }
      })
      .sort((a, b) => b.totalEggs - a.totalEggs)
  }, [records])

  // =========================================================
  // MODAL
  // =========================================================

  const openAddModal = () => {
    setEditingRecord(null)

    setForm({
      record_date: new Date().toISOString().split('T')[0],
      chicken_type_id: chickenTypes[0]?.id || '',
      total_eggs: 0,
      good_eggs: 0,
      broken_eggs: 0,
      rejected_eggs: 0,
      notes: '',
    })

    setShowModal(true)
  }

  const openEditModal = (record) => {
    setEditingRecord(record)

    setForm({
      record_date: record.record_date || '',
      chicken_type_id: record.chicken_type_id || '',
      total_eggs: record.total_eggs || 0,
      good_eggs: record.good_eggs || 0,
      broken_eggs: record.broken_eggs || 0,
      rejected_eggs: record.rejected_eggs || 0,
      notes: record.notes || '',
    })

    setShowModal(true)
  }

  const closeModal = () => {
    if (saving) return

    setShowModal(false)
    setEditingRecord(null)

    setForm({
      record_date: new Date().toISOString().split('T')[0],
      chicken_type_id: chickenTypes[0]?.id || '',
      total_eggs: 0,
      good_eggs: 0,
      broken_eggs: 0,
      rejected_eggs: 0,
      notes: '',
    })
  }

  // =========================================================
  // FORM
  // =========================================================

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: [
        'total_eggs',
        'good_eggs',
        'broken_eggs',
        'rejected_eggs',
      ].includes(name)
        ? Math.max(0, Number(value || 0))
        : value,
    }))
  }

  // =========================================================
  // SAVE
  // =========================================================

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.chicken_type_id) {
      alert('Silakan pilih jenis ayam terlebih dahulu.')
      return
    }

    if (!form.record_date) {
      alert('Tanggal produksi wajib diisi.')
      return
    }

    const totalEggs = Number(form.total_eggs || 0)
    const goodEggs = Number(form.good_eggs || 0)
    const brokenEggs = Number(form.broken_eggs || 0)
    const rejectedEggs = Number(form.rejected_eggs || 0)

    const classifiedEggs =
      goodEggs +
      brokenEggs +
      rejectedEggs

    if (classifiedEggs > totalEggs) {
      alert(
        'Jumlah telur baik + pecah + ditolak tidak boleh melebihi total telur.'
      )
      return
    }

    try {
      setSaving(true)

      if (editingRecord) {
        let query = supabase
          .from('egg_production')
          .update({
            record_date: form.record_date,
            chicken_type_id: form.chicken_type_id,
            total_eggs: totalEggs,
            good_eggs: goodEggs,
            broken_eggs: brokenEggs,
            rejected_eggs: rejectedEggs,
            notes: form.notes?.trim() || null,
          })
          .eq('id', editingRecord.id)

        if (!isSuperAdmin && currentFarmId) {
          query = query.eq(
            'farm_id',
            currentFarmId
          )
        }

        const { error } = await query

        if (error) throw error

        alert(
          'Data produksi telur berhasil diperbarui.'
        )
      } else {
        const payload = {
          record_date: form.record_date,
          chicken_type_id: form.chicken_type_id,
          total_eggs: totalEggs,
          good_eggs: goodEggs,
          broken_eggs: brokenEggs,
          rejected_eggs: rejectedEggs,
          notes: form.notes?.trim() || null,
          created_by: user?.id || null,
          farm_id: currentFarmId,
        }

        const { error } = await supabase
          .from('egg_production')
          .insert(payload)

        if (error) throw error

        alert(
          'Data produksi telur berhasil ditambahkan.'
        )
      }

      closeModal()
      await loadRecords()
    } catch (error) {
      console.error(
        'Gagal menyimpan produksi telur:',
        error
      )

      alert(
        `Gagal menyimpan produksi telur: ${error.message}`
      )
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete = async (record) => {
    const chickenName =
      record.chicken_types?.name ||
      'Tanpa Jenis Ayam'

    const confirmed = window.confirm(
      `Hapus data produksi telur ${chickenName} tanggal ${formatDate(
        record.record_date
      )}?`
    )

    if (!confirmed) return

    try {
      let query = supabase
        .from('egg_production')
        .delete()
        .eq('id', record.id)

      if (!isSuperAdmin && currentFarmId) {
        query = query.eq(
          'farm_id',
          currentFarmId
        )
      }

      const { error } = await query

      if (error) throw error

      alert(
        'Data produksi telur berhasil dihapus.'
      )

      await loadRecords()
    } catch (error) {
      console.error(
        'Gagal menghapus produksi telur:',
        error
      )

      alert(
        `Gagal menghapus data produksi telur: ${error.message}`
      )
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Produksi Telur
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Catat dan pantau produksi telur berdasarkan jenis ayam.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          disabled={chickenTypes.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <span className="text-lg">+</span>
          Tambah Produksi
        </button>
      </div>

      {/* NO CHICKEN TYPE */}
      {!loading && chickenTypes.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <div className="text-xl">
              ⚠️
            </div>

            <div>
              <h3 className="font-semibold text-amber-900">
                Belum ada jenis ayam
              </h3>

              <p className="mt-1 text-sm text-amber-700">
                Tambahkan jenis ayam terlebih dahulu sebelum mencatat produksi telur.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Total Telur"
          value={formatNumber(summary.totalEggs)}
          icon="🥚"
          accent="red"
        />

        <SummaryCard
          title="Telur Baik"
          value={formatNumber(summary.goodEggs)}
          icon="✅"
          accent="green"
        />

        <SummaryCard
          title="Telur Pecah"
          value={formatNumber(summary.brokenEggs)}
          icon="💥"
          accent="orange"
        />

        <SummaryCard
          title="Telur Ditolak"
          value={formatNumber(summary.rejectedEggs)}
          icon="⚠️"
          accent="slate"
        />

        <SummaryCard
          title="Persentase Baik"
          value={`${summary.goodPercentage.toFixed(1)}%`}
          icon="📈"
          accent="blue"
        />
      </div>

      {/* BY TYPE */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Produksi Berdasarkan Jenis Ayam
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Ringkasan produksi telur untuk setiap jenis ayam.
          </p>
        </div>

        {productionByType.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Belum ada data produksi telur.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {productionByType.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 p-4 transition hover:border-red-200 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">
                      Jenis Ayam
                    </p>

                    <h3 className="mt-1 font-bold text-slate-900">
                      {item.name}
                    </h3>
                  </div>

                  <div className="rounded-lg bg-red-50 px-3 py-2 text-right">
                    <p className="text-xs text-red-500">
                      Total
                    </p>

                    <p className="text-lg font-bold text-red-700">
                      {formatNumber(item.totalEggs)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniStat
                    label="Baik"
                    value={item.goodEggs}
                    className="text-green-600"
                  />

                  <MiniStat
                    label="Pecah"
                    value={item.brokenEggs}
                    className="text-orange-600"
                  />

                  <MiniStat
                    label="Ditolak"
                    value={item.rejectedEggs}
                    className="text-red-600"
                  />
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-500">
                      Kualitas telur baik
                    </span>

                    <span className="font-semibold text-green-600">
                      {item.goodPercentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{
                        width: `${Math.min(
                          item.goodPercentage,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">
                  {formatNumber(item.recordCount)} catatan produksi
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FILTER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Cari
            </label>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Cari jenis ayam atau catatan..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Jenis Ayam
            </label>

            <select
              value={filterType}
              onChange={(event) =>
                setFilterType(event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">
                Semua Jenis
              </option>

              {chickenTypes.map((type) => (
                <option
                  key={type.id}
                  value={type.id}
                >
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* HISTORY */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            Riwayat Produksi Telur
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {formatNumber(filteredRecords.length)} catatan ditemukan.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

            <p className="mt-3 text-sm text-slate-500">
              Memuat data produksi...
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl">
              🥚
            </div>

            <h3 className="mt-3 font-semibold text-slate-900">
              Belum ada data
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Belum ada catatan produksi telur yang sesuai.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tanggal
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Jenis Ayam
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Baik
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pecah
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ditolak
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Kualitas
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Catatan
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((record) => {
                    const qualityTotal =
                      calculateQualityTotal(record)

                    const goodPercentage =
                      qualityTotal > 0
                        ? (Number(record.good_eggs || 0) /
                            qualityTotal) *
                          100
                        : 0

                    return (
                      <tr
                        key={record.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                          {formatDate(record.record_date)}
                        </td>

                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-900">
                            {record.chicken_types?.name ||
                              'Tanpa Jenis'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-bold text-slate-900">
                          {formatNumber(record.total_eggs)}
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold text-green-600">
                          {formatNumber(record.good_eggs)}
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold text-orange-600">
                          {formatNumber(record.broken_eggs)}
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold text-red-600">
                          {formatNumber(record.rejected_eggs)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className="font-semibold text-green-600">
                            {goodPercentage.toFixed(1)}%
                          </span>
                        </td>

                        <td className="max-w-[220px] px-5 py-4 text-sm text-slate-500">
                          <span className="line-clamp-2">
                            {record.notes || '-'}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(record)
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(record)
                              }
                              className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
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

            {/* MOBILE */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredRecords.map((record) => {
                const qualityTotal =
                  calculateQualityTotal(record)

                const goodPercentage =
                  qualityTotal > 0
                    ? (Number(record.good_eggs || 0) /
                        qualityTotal) *
                      100
                    : 0

                return (
                  <div
                    key={record.id}
                    className="p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-400">
                          {formatDate(record.record_date)}
                        </p>

                        <h3 className="mt-1 font-bold text-slate-900">
                          {record.chicken_types?.name ||
                            'Tanpa Jenis'}
                        </h3>
                      </div>

                      <div className="rounded-lg bg-red-50 px-3 py-2 text-right">
                        <p className="text-[10px] uppercase text-red-500">
                          Total
                        </p>

                        <p className="font-bold text-red-700">
                          {formatNumber(record.total_eggs)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MobileStat
                        label="Telur Baik"
                        value={record.good_eggs}
                        valueClass="text-green-600"
                      />

                      <MobileStat
                        label="Telur Pecah"
                        value={record.broken_eggs}
                        valueClass="text-orange-600"
                      />

                      <MobileStat
                        label="Telur Ditolak"
                        value={record.rejected_eggs}
                        valueClass="text-red-600"
                      />

                      <MobileStat
                        label="Kualitas Baik"
                        value={`${goodPercentage.toFixed(1)}%`}
                        valueClass="text-blue-600"
                        rawValue
                      />
                    </div>

                    {record.notes && (
                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-medium text-slate-400">
                          Catatan
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {record.notes}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(record)
                        }
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(record)
                        }
                        className="flex-1 rounded-lg border border-red-100 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingRecord
                    ? 'Edit Produksi Telur'
                    : 'Tambah Produksi Telur'}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Catat hasil produksi telur berdasarkan jenis ayam.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {/* DATE + TYPE */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Tanggal Produksi
                  </label>

                  <input
                    type="date"
                    name="record_date"
                    value={form.record_date}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Jenis Ayam
                  </label>

                  <select
                    name="chicken_type_id"
                    value={form.chicken_type_id}
                    onChange={handleChange}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  >
                    <option value="">
                      Pilih jenis ayam
                    </option>

                    {chickenTypes.map((type) => (
                      <option
                        key={type.id}
                        value={type.id}
                      >
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TOTAL */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Total Telur
                </label>

                <input
                  type="number"
                  name="total_eggs"
                  min="0"
                  step="1"
                  value={form.total_eggs}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />

                <p className="mt-1 text-xs text-slate-400">
                  Masukkan seluruh telur yang dihasilkan pada tanggal tersebut.
                </p>
              </div>

              {/* QUALITY */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-4 font-semibold text-slate-900">
                  Klasifikasi Telur
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <NumberInput
                    label="Telur Baik"
                    name="good_eggs"
                    value={form.good_eggs}
                    onChange={handleChange}
                  />

                  <NumberInput
                    label="Telur Pecah"
                    name="broken_eggs"
                    value={form.broken_eggs}
                    onChange={handleChange}
                  />

                  <NumberInput
                    label="Telur Ditolak"
                    name="rejected_eggs"
                    value={form.rejected_eggs}
                    onChange={handleChange}
                  />
                </div>

                <div className="mt-4 rounded-xl bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Total klasifikasi
                    </span>

                    <span className="font-bold text-slate-900">
                      {formatNumber(
                        Number(form.good_eggs || 0) +
                          Number(form.broken_eggs || 0) +
                          Number(form.rejected_eggs || 0)
                      )}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Sisa belum diklasifikasikan
                    </span>

                    <span
                      className={`font-bold ${
                        Number(form.total_eggs || 0) -
                          (
                            Number(form.good_eggs || 0) +
                            Number(form.broken_eggs || 0) +
                            Number(form.rejected_eggs || 0)
                          ) <
                        0
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {formatNumber(
                        Number(form.total_eggs || 0) -
                          (
                            Number(form.good_eggs || 0) +
                            Number(form.broken_eggs || 0) +
                            Number(form.rejected_eggs || 0)
                          )
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* NOTES */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Catatan
                </label>

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Contoh: produksi normal, ada telur pecah saat pengumpulan..."
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* ACTION */}
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
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
                    : editingRecord
                      ? 'Simpan Perubahan'
                      : 'Simpan Produksi'}
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
// COMPONENTS
// =========================================================

function SummaryCard({
  title,
  value,
  icon,
  accent,
}) {
  const accentClasses = {
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${
            accentClasses[accent] ||
            accentClasses.slate
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  className = 'text-slate-700',
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-center">
      <p className="text-[10px] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-bold ${className}`}
      >
        {new Intl.NumberFormat('id-ID').format(
          Number(value || 0)
        )}
      </p>
    </div>
  )
}

function MobileStat({
  label,
  value,
  valueClass = 'text-slate-800',
  rawValue = false,
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 font-bold ${valueClass}`}
      >
        {rawValue
          ? value
          : new Intl.NumberFormat('id-ID').format(
              Number(value || 0)
            )}
      </p>
    </div>
  )
}

function NumberInput({
  label,
  name,
  value,
  onChange,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        type="number"
        min="0"
        step="1"
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
      />
    </div>
  )
}

export default Production