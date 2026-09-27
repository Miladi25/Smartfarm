import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Deaths({ user, farm }) {
  const [records, setRecords] = useState([])
  const [chickenTypes, setChickenTypes] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterCause, setFilterCause] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    record_date: new Date().toISOString().split('T')[0],
    chicken_type_id: '',
    deaths: 0,
    cause: '',
    notes: '',
  })

  const isSuperAdmin = user?.is_super_admin === true

  const currentFarmId =
    farm?.farmId ||
    user?.farm_id ||
    null

  // =========================================================
  // FORMAT
  // =========================================================

  const formatNumber = (value) => {
    return new Intl.NumberFormat('id-ID').format(
      Number(value || 0)
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

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = async () => {
    try {
      setLoading(true)

      let deathsQuery = supabase
        .from('chicken_deaths')
        .select(`
          id,
          record_date,
          deaths,
          cause,
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
        .order('record_date', {
          ascending: false,
        })
        .order('created_at', {
          ascending: false,
        })

      let typesQuery = supabase
        .from('chicken_types')
        .select(`
          id,
          name,
          farm_id
        `)
        .order('name', {
          ascending: true,
        })

      if (!isSuperAdmin && currentFarmId) {
        deathsQuery = deathsQuery.eq(
          'farm_id',
          currentFarmId
        )

        typesQuery = typesQuery.eq(
          'farm_id',
          currentFarmId
        )
      }

      const [
        deathsResult,
        typesResult,
      ] = await Promise.all([
        deathsQuery,
        typesQuery,
      ])

      if (deathsResult.error) {
        throw deathsResult.error
      }

      if (typesResult.error) {
        throw typesResult.error
      }

      setRecords(deathsResult.data || [])
      setChickenTypes(typesResult.data || [])
    } catch (error) {
      console.error(
        'Gagal mengambil data kematian:',
        error
      )

      alert(
        `Gagal mengambil data kematian: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
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
  // FILTER DATA
  // =========================================================

  const causes = useMemo(() => {
    const uniqueCauses = [
      ...new Set(
        records
          .map((record) => record.cause)
          .filter(
            (cause) =>
              cause &&
              cause.trim() !== ''
          )
      ),
    ]

    return uniqueCauses.sort((a, b) =>
      a.localeCompare(b)
    )
  }, [records])

  const filteredRecords = useMemo(() => {
    const keyword =
      search.trim().toLowerCase()

    return records.filter((record) => {
      const typeName =
        record.chicken_types?.name || ''

      const cause =
        record.cause || ''

      const notes =
        record.notes || ''

      const matchesSearch =
        !keyword ||
        typeName.toLowerCase().includes(keyword) ||
        cause.toLowerCase().includes(keyword) ||
        notes.toLowerCase().includes(keyword)

      const matchesType =
        filterType === 'all' ||
        record.chicken_type_id === filterType

      const matchesCause =
        filterCause === 'all' ||
        record.cause === filterCause

      return (
        matchesSearch &&
        matchesType &&
        matchesCause
      )
    })
  }, [
    records,
    search,
    filterType,
    filterCause,
  ])

  // =========================================================
  // SUMMARY
  // =========================================================

  const summary = useMemo(() => {
    const totalDeaths = records.reduce(
      (sum, record) =>
        sum + Number(record.deaths || 0),
      0
    )

    const filteredDeaths = filteredRecords.reduce(
      (sum, record) =>
        sum + Number(record.deaths || 0),
      0
    )

    const totalRecords = records.length

    const affectedTypes = new Set(
      records
        .map(
          (record) =>
            record.chicken_type_id
        )
        .filter(Boolean)
    ).size

    return {
      totalDeaths,
      filteredDeaths,
      totalRecords,
      affectedTypes,
    }
  }, [records, filteredRecords])

  // =========================================================
  // SUMMARY BY TYPE
  // =========================================================

  const deathByType = useMemo(() => {
    const grouped = {}

    records.forEach((record) => {
      const typeId =
        record.chicken_type_id || 'unknown'

      const typeName =
        record.chicken_types?.name ||
        'Tanpa Jenis'

      if (!grouped[typeId]) {
        grouped[typeId] = {
          id: typeId,
          name: typeName,
          deaths: 0,
          records: 0,
        }
      }

      grouped[typeId].deaths +=
        Number(record.deaths || 0)

      grouped[typeId].records += 1
    })

    return Object.values(grouped).sort(
      (a, b) => b.deaths - a.deaths
    )
  }, [records])

  // =========================================================
  // SUMMARY BY CAUSE
  // =========================================================

  const deathByCause = useMemo(() => {
    const grouped = {}

    records.forEach((record) => {
      const cause =
        record.cause?.trim() ||
        'Tidak diketahui'

      if (!grouped[cause]) {
        grouped[cause] = {
          cause,
          deaths: 0,
          records: 0,
        }
      }

      grouped[cause].deaths +=
        Number(record.deaths || 0)

      grouped[cause].records += 1
    })

    return Object.values(grouped).sort(
      (a, b) => b.deaths - a.deaths
    )
  }, [records])

  // =========================================================
  // OPEN ADD MODAL
  // =========================================================

  const openAddModal = () => {
    setEditingId(null)

    setForm({
      record_date: new Date()
        .toISOString()
        .split('T')[0],

      chicken_type_id:
        chickenTypes[0]?.id || '',

      deaths: 0,

      cause: '',

      notes: '',
    })

    setShowModal(true)
  }

  // =========================================================
  // OPEN EDIT MODAL
  // =========================================================

  const openEditModal = (record) => {
    setEditingId(record.id)

    setForm({
      record_date:
        record.record_date ||
        new Date()
          .toISOString()
          .split('T')[0],

      chicken_type_id:
        record.chicken_type_id || '',

      deaths:
        Number(record.deaths || 0),

      cause:
        record.cause || '',

      notes:
        record.notes || '',
    })

    setShowModal(true)
  }

  // =========================================================
  // HANDLE FORM
  // =========================================================

  const handleChange = (
    field,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // =========================================================
  // SAVE
  // =========================================================

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.chicken_type_id) {
      alert(
        'Silakan pilih jenis ayam terlebih dahulu.'
      )
      return
    }

    const deathCount = Math.max(
      0,
      Number(form.deaths || 0)
    )

    if (deathCount <= 0) {
      alert(
        'Jumlah kematian harus lebih dari 0.'
      )
      return
    }

    try {
      setSaving(true)

      const payload = {
        record_date:
          form.record_date,

        deaths:
          deathCount,

        cause:
          form.cause.trim() || null,

        notes:
          form.notes.trim() || null,

        chicken_type_id:
          form.chicken_type_id,

        farm_id:
          currentFarmId || null,

        created_by:
          user?.id || null,
      }

      if (editingId) {
        const { error } =
          await supabase
            .from('chicken_deaths')
            .update(payload)
            .eq(
              'id',
              editingId
            )

        if (error) {
          throw error
        }

        alert(
          'Data kematian berhasil diperbarui.'
        )
      } else {
        const { error } =
          await supabase
            .from('chicken_deaths')
            .insert([payload])

        if (error) {
          throw error
        }

        alert(
          'Data kematian berhasil ditambahkan.'
        )
      }

      setShowModal(false)
      setEditingId(null)

      await loadData()
    } catch (error) {
      console.error(
        'Gagal menyimpan data kematian:',
        error
      )

      alert(
        `Gagal menyimpan data kematian: ${error.message}`
      )
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete = async (
    record
  ) => {
    const typeName =
      record.chicken_types?.name ||
      'Tanpa Jenis'

    const confirmed = window.confirm(
      `Hapus pencatatan kematian ${typeName} tanggal ${formatDate(
        record.record_date
      )}?`
    )

    if (!confirmed) return

    try {
      const { error } =
        await supabase
          .from('chicken_deaths')
          .delete()
          .eq(
            'id',
            record.id
          )

      if (error) {
        throw error
      }

      await loadData()

      alert(
        'Data kematian berhasil dihapus.'
      )
    } catch (error) {
      console.error(
        'Gagal menghapus data kematian:',
        error
      )

      alert(
        `Gagal menghapus data kematian: ${error.message}`
      )
    }
  }

  // =========================================================
  // MAX BAR CHART
  // =========================================================

  const maxDeathsByType =
    Math.max(
      ...deathByType.map(
        (item) =>
          Number(item.deaths || 0)
      ),
      1
    )

  const maxDeathsByCause =
    Math.max(
      ...deathByCause.map(
        (item) =>
          Number(item.deaths || 0)
      ),
      1
    )

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Kematian Ayam
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Catat kematian ayam berdasarkan jenis, tanggal, dan penyebab.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          disabled={
            chickenTypes.length === 0
          }
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <span className="text-lg">
            +
          </span>

          Tambah Kematian
        </button>
      </div>

      {/* NO CHICKEN TYPE */}
      {!loading &&
        chickenTypes.length === 0 && (
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
                  Tambahkan jenis ayam terlebih dahulu sebelum mencatat kematian.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Kematian"
          value={formatNumber(
            summary.totalDeaths
          )}
          suffix="ekor"
          icon="☠️"
          type="red"
        />

        <SummaryCard
          title="Data Pencatatan"
          value={formatNumber(
            summary.totalRecords
          )}
          suffix="data"
          icon="📋"
          type="blue"
        />

        <SummaryCard
          title="Jenis Terdampak"
          value={formatNumber(
            summary.affectedTypes
          )}
          suffix="jenis"
          icon="🐔"
          type="orange"
        />

        <SummaryCard
          title="Hasil Filter"
          value={formatNumber(
            summary.filteredDeaths
          )}
          suffix="ekor"
          icon="📊"
          type="green"
        />
      </div>

      {/* ANALYSIS */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* BY TYPE */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Kematian per Jenis Ayam
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Total kematian berdasarkan jenis ayam.
            </p>
          </div>

          {deathByType.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Belum ada data.
            </div>
          ) : (
            <div className="space-y-5 p-5">
              {deathByType.map(
                (item) => {
                  const percentage =
                    (Number(
                      item.deaths
                    ) /
                      maxDeathsByType) *
                    100

                  return (
                    <div
                      key={item.id}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-slate-700">
                          {item.name}
                        </span>

                        <span className="text-sm font-bold text-red-600">
                          {formatNumber(
                            item.deaths
                          )}{' '}
                          ekor
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-red-500 transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>

                      <p className="mt-1 text-xs text-slate-400">
                        {formatNumber(
                          item.records
                        )}{' '}
                        pencatatan
                      </p>
                    </div>
                  )
                }
              )}
            </div>
          )}
        </div>

        {/* BY CAUSE */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Penyebab Kematian
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Distribusi kematian berdasarkan penyebab.
            </p>
          </div>

          {deathByCause.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Belum ada data penyebab.
            </div>
          ) : (
            <div className="space-y-5 p-5">
              {deathByCause.map(
                (item) => {
                  const percentage =
                    (Number(
                      item.deaths
                    ) /
                      maxDeathsByCause) *
                    100

                  return (
                    <div
                      key={item.cause}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-slate-700">
                          {item.cause}
                        </span>

                        <span className="shrink-0 text-sm font-bold text-orange-600">
                          {formatNumber(
                            item.deaths
                          )}{' '}
                          ekor
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>

                      <p className="mt-1 text-xs text-slate-400">
                        {formatNumber(
                          item.records
                        )}{' '}
                        pencatatan
                      </p>
                    </div>
                  )
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* FILTER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
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
              placeholder="Cari jenis, penyebab, catatan..."
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <select
            value={filterType}
            onChange={(event) =>
              setFilterType(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          >
            <option value="all">
              Semua Jenis Ayam
            </option>

            {chickenTypes.map(
              (type) => (
                <option
                  key={type.id}
                  value={type.id}
                >
                  {type.name}
                </option>
              )
            )}
          </select>

          <select
            value={filterCause}
            onChange={(event) =>
              setFilterCause(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          >
            <option value="all">
              Semua Penyebab
            </option>

            {causes.map(
              (cause) => (
                <option
                  key={cause}
                  value={cause}
                >
                  {cause}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* HISTORY */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Riwayat Kematian
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Daftar seluruh pencatatan kematian ayam.
            </p>
          </div>

          <span className="w-fit rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {formatNumber(
              filteredRecords.length
            )}{' '}
            data
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

            <p className="mt-4 text-sm text-slate-500">
              Memuat data kematian...
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            text={
              records.length === 0
                ? 'Belum ada pencatatan kematian.'
                : 'Tidak ada data yang sesuai dengan filter.'
            }
          />
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[950px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tanggal
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Jenis Ayam
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Jumlah Mati
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Penyebab
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Catatan
                    </th>

                    <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map(
                    (record) => (
                      <tr
                        key={record.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 text-sm text-slate-700">
                          {formatDate(
                            record.record_date
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {record
                              .chicken_types
                              ?.name ||
                              'Tanpa Jenis'}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-bold text-red-600">
                            {formatNumber(
                              record.deaths
                            )}{' '}
                            ekor
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {record.cause ? (
                            <span className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
                              {
                                record.cause
                              }
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Tidak dicatat
                            </span>
                          )}
                        </td>

                        <td className="max-w-xs px-5 py-4">
                          <p className="truncate text-sm text-slate-500">
                            {record.notes ||
                              '-'}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  record
                                )
                              }
                              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  record
                                )
                              }
                              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredRecords.map(
                (record) => (
                  <div
                    key={record.id}
                    className="p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          {record
                            .chicken_types
                            ?.name ||
                            'Tanpa Jenis'}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(
                            record.record_date
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-red-50 px-3 py-2 text-right">
                        <p className="text-[10px] font-medium text-red-500">
                          Kematian
                        </p>

                        <p className="font-bold text-red-600">
                          {formatNumber(
                            record.deaths
                          )}{' '}
                          ekor
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-orange-50 p-3">
                        <p className="text-[10px] text-orange-500">
                          Penyebab
                        </p>

                        <p className="mt-1 text-sm font-semibold text-orange-700">
                          {record.cause ||
                            'Tidak dicatat'}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[10px] text-slate-400">
                          Catatan
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {record.notes ||
                            '-'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(
                            record
                          )
                        }
                        className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            record
                          )
                        }
                        className="flex-1 rounded-xl bg-red-50 py-2.5 text-sm font-semibold text-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? 'Edit Data Kematian'
                    : 'Tambah Kematian'}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Catat jumlah dan penyebab kematian ayam.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5"
            >
              {/* DATE + TYPE */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Tanggal
                  </label>

                  <input
                    type="date"
                    value={
                      form.record_date
                    }
                    onChange={(event) =>
                      handleChange(
                        'record_date',
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Jenis Ayam
                  </label>

                  <select
                    value={
                      form.chicken_type_id
                    }
                    onChange={(event) =>
                      handleChange(
                        'chicken_type_id',
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  >
                    <option value="">
                      Pilih jenis ayam
                    </option>

                    {chickenTypes.map(
                      (type) => (
                        <option
                          key={type.id}
                          value={type.id}
                        >
                          {type.name}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* DEATH COUNT */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Jumlah Kematian
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={form.deaths}
                    onChange={(event) =>
                      handleChange(
                        'deaths',
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-16 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />

                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                    ekor
                  </span>
                </div>
              </div>

              {/* CAUSE */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Penyebab Kematian
                </label>

                <input
                  type="text"
                  value={form.cause}
                  onChange={(event) =>
                    handleChange(
                      'cause',
                      event.target.value
                    )
                  }
                  placeholder="Contoh: Sakit, kecelakaan, cuaca, predator..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* NOTES */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Catatan
                </label>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    handleChange(
                      'notes',
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Tambahkan keterangan jika diperlukan..."
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {/* PREVIEW */}
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      Jumlah Kematian
                    </p>

                    <p className="mt-1 text-xs text-red-500">
                      Data akan masuk ke analisis kematian.
                    </p>
                  </div>

                  <p className="text-2xl font-bold text-red-600">
                    {formatNumber(
                      form.deaths
                    )}{' '}
                    ekor
                  </p>
                </div>
              </div>

              {/* BUTTON */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  disabled={saving}
                  className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
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
                      : 'Simpan Kematian'}
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
// SUMMARY CARD
// =========================================================

function SummaryCard({
  title,
  value,
  suffix,
  icon,
  type,
}) {
  const styles = {
    red: {
      icon: 'bg-red-50 text-red-600',
      value: 'text-red-600',
    },

    blue: {
      icon: 'bg-blue-50 text-blue-600',
      value: 'text-blue-600',
    },

    orange: {
      icon: 'bg-orange-50 text-orange-600',
      value: 'text-orange-600',
    },

    green: {
      icon: 'bg-emerald-50 text-emerald-600',
      value: 'text-emerald-600',
    },
  }

  const selected =
    styles[type] || styles.red

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <div className="mt-2 flex items-baseline gap-1">
            <p
              className={`text-2xl font-bold ${selected.value}`}
            >
              {value}
            </p>

            <span className="text-xs font-medium text-slate-400">
              {suffix}
            </span>
          </div>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${selected.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

// =========================================================
// EMPTY STATE
// =========================================================

function EmptyState({
  text,
}) {
  return (
    <div className="p-12 text-center">
      <div className="text-4xl">
        🐔
      </div>

      <p className="mt-3 text-sm text-slate-500">
        {text}
      </p>
    </div>
  )
}

export default Deaths