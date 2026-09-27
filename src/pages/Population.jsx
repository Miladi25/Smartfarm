import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Population({ user, farm }) {
  const [records, setRecords] = useState([])
  const [chickenTypes, setChickenTypes] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    record_date: new Date()
      .toISOString()
      .split('T')[0],
    chicken_type_id: '',
    initial_population: 0,
    incoming: 0,
    outgoing: 0,
    deaths: 0,
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

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = async () => {
    try {
      setLoading(true)

      let populationQuery = supabase
        .from('chicken_population')
        .select(`
          id,
          record_date,
          initial_population,
          incoming,
          outgoing,
          deaths,
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

      let typeQuery = supabase
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
        populationQuery =
          populationQuery.eq(
            'farm_id',
            currentFarmId
          )

        typeQuery = typeQuery.eq(
          'farm_id',
          currentFarmId
        )
      }

      const [
        populationResult,
        typeResult,
      ] = await Promise.all([
        populationQuery,
        typeQuery,
      ])

      if (populationResult.error) {
        throw populationResult.error
      }

      if (typeResult.error) {
        throw typeResult.error
      }

      setRecords(
        populationResult.data || []
      )

      setChickenTypes(
        typeResult.data || []
      )
    } catch (error) {
      console.error(
        'Gagal mengambil data populasi:',
        error
      )

      alert(
        `Gagal mengambil data populasi: ${error.message}`
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
  // CURRENT POPULATION
  // =========================================================

  const calculateCurrent = (record) => {
    return (
      Number(
        record?.initial_population || 0
      ) +
      Number(record?.incoming || 0) -
      Number(record?.outgoing || 0) -
      Number(record?.deaths || 0)
    )
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredRecords = useMemo(() => {
    const keyword =
      search.trim().toLowerCase()

    return records.filter((record) => {
      const typeName =
        record.chicken_types?.name ||
        ''

      const matchesSearch =
        !keyword ||
        typeName
          .toLowerCase()
          .includes(keyword) ||
        String(record.notes || '')
          .toLowerCase()
          .includes(keyword)

      const matchesType =
        filterType === 'all' ||
        record.chicken_type_id ===
          filterType

      return (
        matchesSearch &&
        matchesType
      )
    })
  }, [
    records,
    search,
    filterType,
  ])

  // =========================================================
  // SUMMARY PER CHICKEN TYPE
  // =========================================================

  const populationSummary = useMemo(() => {
    const grouped = {}

    records.forEach((record) => {
      const typeId =
        record.chicken_type_id ||
        'unknown'

      const typeName =
        record.chicken_types?.name ||
        'Tanpa Jenis'

      if (!grouped[typeId]) {
        grouped[typeId] = {
          id: typeId,
          name: typeName,
          current: 0,
          incoming: 0,
          outgoing: 0,
          deaths: 0,
          latestDate:
            record.record_date,
        }
      }

      grouped[typeId].incoming +=
        Number(record.incoming || 0)

      grouped[typeId].outgoing +=
        Number(record.outgoing || 0)

      grouped[typeId].deaths +=
        Number(record.deaths || 0)
    })

    // Ambil record paling baru untuk current population.
    Object.values(grouped).forEach(
      (item) => {
        const typeRecords =
          records
            .filter(
              (record) =>
                (record.chicken_type_id ||
                  'unknown') === item.id
            )
            .sort((a, b) => {
              const dateDiff =
                new Date(
                  b.record_date
                ) -
                new Date(
                  a.record_date
                )

              if (dateDiff !== 0) {
                return dateDiff
              }

              return (
                new Date(
                  b.created_at || 0
                ) -
                new Date(
                  a.created_at || 0
                )
              )
            })

        if (typeRecords.length > 0) {
          item.current =
            calculateCurrent(
              typeRecords[0]
            )

          item.latestDate =
            typeRecords[0].record_date
        }
      }
    )

    return Object.values(grouped).sort(
      (a, b) =>
        b.current - a.current
    )
  }, [records])

  // =========================================================
  // TOTAL SUMMARY
  // =========================================================

  const totalSummary = useMemo(() => {
    const currentPopulation =
      populationSummary.reduce(
        (sum, item) =>
          sum +
          Math.max(
            0,
            Number(item.current || 0)
          ),
        0
      )

    const totalIncoming =
      records.reduce(
        (sum, record) =>
          sum +
          Number(
            record.incoming || 0
          ),
        0
      )

    const totalOutgoing =
      records.reduce(
        (sum, record) =>
          sum +
          Number(
            record.outgoing || 0
          ),
        0
      )

    const totalDeaths =
      records.reduce(
        (sum, record) =>
          sum +
          Number(
            record.deaths || 0
          ),
        0
      )

    return {
      currentPopulation,
      totalIncoming,
      totalOutgoing,
      totalDeaths,
      types:
        populationSummary.length,
      records: records.length,
    }
  }, [
    populationSummary,
    records,
  ])

  // =========================================================
  // OPEN ADD
  // =========================================================

  const openAddModal = () => {
    setEditingId(null)

    setForm({
      record_date: new Date()
        .toISOString()
        .split('T')[0],
      chicken_type_id:
        chickenTypes[0]?.id || '',
      initial_population: 0,
      incoming: 0,
      outgoing: 0,
      deaths: 0,
      notes: '',
    })

    setShowModal(true)
  }

  // =========================================================
  // GET PREVIOUS POPULATION
  // =========================================================

  const loadPreviousPopulation = async (
    chickenTypeId,
    recordDate
  ) => {
    if (!chickenTypeId) return

    try {
      let query = supabase
        .from('chicken_population')
        .select(`
          id,
          record_date,
          initial_population,
          incoming,
          outgoing,
          deaths,
          created_at
        `)
        .eq(
          'chicken_type_id',
          chickenTypeId
        )
        .lt(
          'record_date',
          recordDate
        )
        .order('record_date', {
          ascending: false,
        })
        .order('created_at', {
          ascending: false,
        })
        .limit(1)

      if (!isSuperAdmin && currentFarmId) {
        query = query.eq(
          'farm_id',
          currentFarmId
        )
      }

      const { data, error } =
        await query.maybeSingle()

      if (error) {
        console.error(
          'Gagal mencari populasi sebelumnya:',
          error
        )
        return
      }

      if (data) {
        const previous =
          calculateCurrent(data)

        setForm((prev) => ({
          ...prev,
          initial_population:
            Math.max(0, previous),
        }))
      }
    } catch (error) {
      console.error(error)
    }
  }

  // =========================================================
  // FORM CHANGE
  // =========================================================

  const handleFormChange = (
    field,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleChickenTypeChange = async (
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      chicken_type_id: value,
    }))

    if (!editingId && value) {
      await loadPreviousPopulation(
        value,
        form.record_date
      )
    }
  }

  const handleDateChange = async (
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      record_date: value,
    }))

    if (
      !editingId &&
      form.chicken_type_id &&
      value
    ) {
      await loadPreviousPopulation(
        form.chicken_type_id,
        value
      )
    }
  }

  // =========================================================
  // EDIT
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

      initial_population:
        Number(
          record.initial_population || 0
        ),

      incoming:
        Number(record.incoming || 0),

      outgoing:
        Number(record.outgoing || 0),

      deaths:
        Number(record.deaths || 0),

      notes:
        record.notes || '',
    })

    setShowModal(true)
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

    const initialPopulation = Math.max(
      0,
      Number(
        form.initial_population || 0
      )
    )

    const incoming = Math.max(
      0,
      Number(form.incoming || 0)
    )

    const outgoing = Math.max(
      0,
      Number(form.outgoing || 0)
    )

    const deaths = Math.max(
      0,
      Number(form.deaths || 0)
    )

    const currentPopulation =
      initialPopulation +
      incoming -
      outgoing -
      deaths

    if (currentPopulation < 0) {
      alert(
        'Populasi akhir tidak boleh kurang dari 0.'
      )
      return
    }

    try {
      setSaving(true)

      const payload = {
        record_date:
          form.record_date,

        initial_population:
          initialPopulation,

        incoming,

        outgoing,

        deaths,

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
            .from(
              'chicken_population'
            )
            .update(payload)
            .eq(
              'id',
              editingId
            )

        if (error) {
          throw error
        }

        alert(
          'Data populasi berhasil diperbarui.'
        )
      } else {
        const { error } =
          await supabase
            .from(
              'chicken_population'
            )
            .insert([payload])

        if (error) {
          throw error
        }

        alert(
          'Data populasi berhasil ditambahkan.'
        )
      }

      setShowModal(false)
      setEditingId(null)

      await loadData()
    } catch (error) {
      console.error(
        'Gagal menyimpan populasi:',
        error
      )

      alert(
        `Gagal menyimpan data populasi: ${error.message}`
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
      `Hapus data populasi ${typeName} tanggal ${formatDate(
        record.record_date
      )}?`
    )

    if (!confirmed) return

    try {
      const { error } =
        await supabase
          .from('chicken_population')
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
        'Data populasi berhasil dihapus.'
      )
    } catch (error) {
      console.error(
        'Gagal menghapus populasi:',
        error
      )

      alert(
        `Gagal menghapus data populasi: ${error.message}`
      )
    }
  }

  // =========================================================
  // FORM CURRENT PREVIEW
  // =========================================================

  const formCurrentPopulation =
    Math.max(
      0,
      Number(
        form.initial_population || 0
      ) +
        Number(form.incoming || 0) -
        Number(form.outgoing || 0) -
        Number(form.deaths || 0)
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
            Populasi Ayam
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Kelola jumlah populasi ayam berdasarkan jenis dan riwayat pencatatan.
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

          Tambah Populasi
        </button>
      </div>

      {/* WARNING NO TYPE */}
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
                  Tambahkan jenis ayam terlebih dahulu sebelum mencatat populasi.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Populasi Saat Ini"
          value={formatNumber(
            totalSummary.currentPopulation
          )}
          suffix="ekor"
          icon="🐔"
          type="red"
        />

        <SummaryCard
          title="Ayam Masuk"
          value={formatNumber(
            totalSummary.totalIncoming
          )}
          suffix="ekor"
          icon="📥"
          type="green"
        />

        <SummaryCard
          title="Ayam Keluar"
          value={formatNumber(
            totalSummary.totalOutgoing
          )}
          suffix="ekor"
          icon="📤"
          type="blue"
        />

        <SummaryCard
          title="Kematian"
          value={formatNumber(
            totalSummary.totalDeaths
          )}
          suffix="ekor"
          icon="☠️"
          type="orange"
        />
      </div>

      {/* FILTER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
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
              placeholder="Cari jenis ayam atau catatan..."
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
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 lg:w-64"
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
        </div>
      </div>

      {/* POPULATION BY TYPE */}
      {!loading &&
        populationSummary.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">
                Ringkasan Populasi
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Populasi terakhir berdasarkan jenis ayam.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {populationSummary.map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4 transition hover:border-red-200 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">
                          {item.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Update{' '}
                          {formatDate(
                            item.latestDate
                          )}
                        </p>
                      </div>

                      <span className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-bold text-red-600">
                        {formatNumber(
                          item.current
                        )}{' '}
                        ekor
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <MiniStat
                        label="Masuk"
                        value={
                          item.incoming
                        }
                        type="green"
                      />

                      <MiniStat
                        label="Keluar"
                        value={
                          item.outgoing
                        }
                        type="blue"
                      />

                      <MiniStat
                        label="Mati"
                        value={
                          item.deaths
                        }
                        type="orange"
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

      {/* TABLE */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Riwayat Populasi
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Semua pencatatan perubahan populasi ayam.
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
              Memuat data populasi...
            </p>
          </div>
        ) : filteredRecords.length ===
          0 ? (
          <EmptyState
            text={
              records.length === 0
                ? 'Belum ada pencatatan populasi.'
                : 'Tidak ada data yang sesuai dengan filter.'
            }
          />
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tanggal
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Jenis Ayam
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Populasi Awal
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Masuk
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Keluar
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Mati
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Populasi Akhir
                    </th>

                    <th className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map(
                    (record) => {
                      const current =
                        calculateCurrent(
                          record
                        )

                      return (
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

                            {record.notes && (
                              <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                                {
                                  record.notes
                                }
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-medium text-slate-700">
                            {formatNumber(
                              record.initial_population
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-semibold text-emerald-600">
                            +
                            {formatNumber(
                              record.incoming
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-semibold text-blue-600">
                            -
                            {formatNumber(
                              record.outgoing
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-semibold text-orange-600">
                            -
                            {formatNumber(
                              record.deaths
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">
                            <span
                              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                                current >
                                0
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {formatNumber(
                                current
                              )}
                            </span>
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
                    }
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredRecords.map(
                (record) => {
                  const current =
                    calculateCurrent(
                      record
                    )

                  return (
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
                            Populasi Akhir
                          </p>

                          <p className="font-bold text-red-600">
                            {formatNumber(
                              current
                            )}{' '}
                            ekor
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MobileValue
                          label="Awal"
                          value={
                            record.initial_population
                          }
                        />

                        <MobileValue
                          label="Masuk"
                          value={
                            record.incoming
                          }
                          type="green"
                        />

                        <MobileValue
                          label="Keluar"
                          value={
                            record.outgoing
                          }
                          type="blue"
                        />

                        <MobileValue
                          label="Mati"
                          value={
                            record.deaths
                          }
                          type="orange"
                        />
                      </div>

                      {record.notes && (
                        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            Catatan:
                          </span>{' '}
                          {record.notes}
                        </div>
                      )}

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
                }
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId
                    ? 'Edit Populasi'
                    : 'Tambah Populasi'}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Catat perubahan jumlah populasi ayam.
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* DATE */}
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
                      handleDateChange(
                        event.target
                          .value
                      )
                    }
                    required
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {/* TYPE */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Jenis Ayam
                  </label>

                  <select
                    value={
                      form.chicken_type_id
                    }
                    onChange={(event) =>
                      handleChickenTypeChange(
                        event.target
                          .value
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

              {/* POPULATION INPUTS */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberInput
                  label="Populasi Awal"
                  value={
                    form.initial_population
                  }
                  onChange={(value) =>
                    handleFormChange(
                      'initial_population',
                      value
                    )
                  }
                  min="0"
                />

                <NumberInput
                  label="Ayam Masuk"
                  value={
                    form.incoming
                  }
                  onChange={(value) =>
                    handleFormChange(
                      'incoming',
                      value
                    )
                  }
                  min="0"
                />

                <NumberInput
                  label="Ayam Keluar"
                  value={
                    form.outgoing
                  }
                  onChange={(value) =>
                    handleFormChange(
                      'outgoing',
                      value
                    )
                  }
                  min="0"
                />

                <NumberInput
                  label="Kematian"
                  value={
                    form.deaths
                  }
                  onChange={(value) =>
                    handleFormChange(
                      'deaths',
                      value
                    )
                  }
                  min="0"
                />
              </div>

              {/* CURRENT PREVIEW */}
              <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      Populasi Akhir
                    </p>

                    <p className="mt-1 text-xs text-red-500">
                      Awal + Masuk − Keluar − Kematian
                    </p>
                  </div>

                  <p className="text-3xl font-bold text-red-600">
                    {formatNumber(
                      formCurrentPopulation
                    )}
                    <span className="ml-1 text-sm font-medium">
                      ekor
                    </span>
                  </p>
                </div>
              </div>

              {/* NOTES */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Catatan
                </label>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    handleFormChange(
                      'notes',
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Tambahkan catatan jika diperlukan..."
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
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
                      : 'Simpan Populasi'}
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

    green: {
      icon: 'bg-emerald-50 text-emerald-600',
      value: 'text-emerald-600',
    },

    blue: {
      icon: 'bg-blue-50 text-blue-600',
      value: 'text-blue-600',
    },

    orange: {
      icon: 'bg-orange-50 text-orange-600',
      value: 'text-orange-600',
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
// MINI STAT
// =========================================================

function MiniStat({
  label,
  value,
  type,
}) {
  const styles = {
    green:
      'bg-emerald-50 text-emerald-600',

    blue:
      'bg-blue-50 text-blue-600',

    orange:
      'bg-orange-50 text-orange-600',
  }

  return (
    <div
      className={`rounded-lg p-2 ${styles[type]}`}
    >
      <p className="text-[10px] opacity-70">
        {label}
      </p>

      <p className="mt-0.5 text-sm font-bold">
        {new Intl.NumberFormat(
          'id-ID'
        ).format(Number(value || 0))}
      </p>
    </div>
  )
}

// =========================================================
// MOBILE VALUE
// =========================================================

function MobileValue({
  label,
  value,
  type = '',
}) {
  const styles = {
    green: 'text-emerald-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
    '': 'text-slate-700',
  }

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[10px] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-bold ${styles[type]}`}
      >
        {new Intl.NumberFormat(
          'id-ID'
        ).format(Number(value || 0))}
      </p>
    </div>
  )
}

// =========================================================
// NUMBER INPUT
// =========================================================

function NumberInput({
  label,
  value,
  onChange,
  min = '0',
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        required
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
      />
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

export default Population