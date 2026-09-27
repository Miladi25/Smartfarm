import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function ProductionAnalysis({ user, farm }) {
  const [productions, setProductions] = useState([])
  const [populations, setPopulations] = useState([])
  const [deaths, setDeaths] = useState([])
  const [chickenTypes, setChickenTypes] = useState([])

  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [period, setPeriod] = useState('30')

  const isSuperAdmin = user?.is_super_admin === true
  const currentFarmId = farm?.farmId || user?.farm_id || null

  // =========================================================
  // HELPER
  // =========================================================

  const formatNumber = (value) => {
    return new Intl.NumberFormat('id-ID').format(
      Number(value || 0)
    )
  }

  const formatDecimal = (value, digits = 1) => {
    return Number(value || 0).toLocaleString('id-ID', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
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

  const shortDate = (date) => {
    if (!date) return ''

    return new Date(`${date}T00:00:00`).toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: 'short',
      }
    )
  }

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = async () => {
    try {
      setLoading(true)

      let productionQuery = supabase
        .from('egg_production')
        .select(`
          id,
          record_date,
          total_eggs,
          good_eggs,
          broken_eggs,
          rejected_eggs,
          notes,
          created_at,
          chicken_type_id,
          farm_id,
          chicken_types (
            id,
            name
          )
        `)
        .order('record_date', {
          ascending: true,
        })

      let populationQuery = supabase
        .from('chicken_population')
        .select(`
          id,
          record_date,
          initial_population,
          incoming,
          outgoing,
          deaths,
          chicken_type_id,
          farm_id,
          chicken_types (
            id,
            name
          )
        `)
        .order('record_date', {
          ascending: true,
        })

      let deathsQuery = supabase
        .from('chicken_deaths')
        .select(`
          id,
          record_date,
          deaths,
          chicken_type_id,
          farm_id,
          chicken_types (
            id,
            name
          )
        `)
        .order('record_date', {
          ascending: true,
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
        productionQuery = productionQuery.eq(
          'farm_id',
          currentFarmId
        )

        populationQuery = populationQuery.eq(
          'farm_id',
          currentFarmId
        )

        deathsQuery = deathsQuery.eq(
          'farm_id',
          currentFarmId
        )

        typeQuery = typeQuery.eq(
          'farm_id',
          currentFarmId
        )
      }

      const [
        productionResult,
        populationResult,
        deathsResult,
        typeResult,
      ] = await Promise.all([
        productionQuery,
        populationQuery,
        deathsQuery,
        typeQuery,
      ])

      if (productionResult.error) {
        throw productionResult.error
      }

      if (populationResult.error) {
        throw populationResult.error
      }

      if (deathsResult.error) {
        throw deathsResult.error
      }

      if (typeResult.error) {
        throw typeResult.error
      }

      setProductions(productionResult.data || [])
      setPopulations(populationResult.data || [])
      setDeaths(deathsResult.data || [])
      setChickenTypes(typeResult.data || [])
    } catch (error) {
      console.error(
        'Gagal mengambil data analisis produksi:',
        error
      )

      alert(
        `Gagal mengambil data analisis produksi: ${error.message}`
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
  // FILTER DATA BERDASARKAN JENIS
  // =========================================================

  const filteredProductions = useMemo(() => {
    return productions.filter((item) => {
      if (filterType === 'all') return true

      return item.chicken_type_id === filterType
    })
  }, [productions, filterType])

  const filteredPopulations = useMemo(() => {
    return populations.filter((item) => {
      if (filterType === 'all') return true

      return item.chicken_type_id === filterType
    })
  }, [populations, filterType])

  const filteredDeaths = useMemo(() => {
    return deaths.filter((item) => {
      if (filterType === 'all') return true

      return item.chicken_type_id === filterType
    })
  }, [deaths, filterType])

  // =========================================================
  // TOTAL SUMMARY
  // =========================================================

  const summary = useMemo(() => {
    const totalEggs = filteredProductions.reduce(
      (sum, item) =>
        sum + Number(item.total_eggs || 0),
      0
    )

    const goodEggs = filteredProductions.reduce(
      (sum, item) =>
        sum + Number(item.good_eggs || 0),
      0
    )

    const brokenEggs = filteredProductions.reduce(
      (sum, item) =>
        sum + Number(item.broken_eggs || 0),
      0
    )

    const rejectedEggs = filteredProductions.reduce(
      (sum, item) =>
        sum + Number(item.rejected_eggs || 0),
      0
    )

    const totalDeaths = filteredDeaths.reduce(
      (sum, item) =>
        sum + Number(item.deaths || 0),
      0
    )

    const totalRecords = filteredProductions.length

    const goodPercentage =
      totalEggs > 0
        ? (goodEggs / totalEggs) * 100
        : 0

    const averageDaily =
      totalRecords > 0
        ? totalEggs / totalRecords
        : 0

    return {
      totalEggs,
      goodEggs,
      brokenEggs,
      rejectedEggs,
      totalDeaths,
      totalRecords,
      goodPercentage,
      averageDaily,
    }
  }, [filteredProductions, filteredDeaths])

  // =========================================================
  // CURRENT POPULATION
  // =========================================================

  const currentPopulation = useMemo(() => {
    const grouped = {}

    filteredPopulations.forEach((item) => {
      const typeId =
        item.chicken_type_id || 'unknown'

      const typeName =
        item.chicken_types?.name ||
        'Tanpa Jenis'

      if (!grouped[typeId]) {
        grouped[typeId] = {
          id: typeId,
          name: typeName,
          recordDate: item.record_date,
          population: 0,
        }
      }

      const calculatedPopulation =
        Number(item.initial_population || 0) +
        Number(item.incoming || 0) -
        Number(item.outgoing || 0) -
        Number(item.deaths || 0)

      if (
        new Date(item.record_date) >=
        new Date(grouped[typeId].recordDate)
      ) {
        grouped[typeId].recordDate =
          item.record_date

        grouped[typeId].population =
          Math.max(
            0,
            calculatedPopulation
          )
      }
    })

    return Object.values(grouped)
  }, [filteredPopulations])

  const totalCurrentPopulation = useMemo(() => {
    return currentPopulation.reduce(
      (sum, item) =>
        sum + Number(item.population || 0),
      0
    )
  }, [currentPopulation])

  // =========================================================
  // PRODUCTION BY TYPE
  // =========================================================

  const productionByType = useMemo(() => {
    const grouped = {}

    filteredProductions.forEach((item) => {
      const typeId =
        item.chicken_type_id || 'unknown'

      const typeName =
        item.chicken_types?.name ||
        'Tanpa Jenis'

      if (!grouped[typeId]) {
        grouped[typeId] = {
          id: typeId,
          name: typeName,
          totalEggs: 0,
          goodEggs: 0,
          brokenEggs: 0,
          rejectedEggs: 0,
          records: 0,
        }
      }

      grouped[typeId].totalEggs +=
        Number(item.total_eggs || 0)

      grouped[typeId].goodEggs +=
        Number(item.good_eggs || 0)

      grouped[typeId].brokenEggs +=
        Number(item.broken_eggs || 0)

      grouped[typeId].rejectedEggs +=
        Number(item.rejected_eggs || 0)

      grouped[typeId].records += 1
    })

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        goodPercentage:
          item.totalEggs > 0
            ? (item.goodEggs /
                item.totalEggs) *
              100
            : 0,
        averageDaily:
          item.records > 0
            ? item.totalEggs /
              item.records
            : 0,
      }))
      .sort(
        (a, b) =>
          b.totalEggs - a.totalEggs
      )
  }, [filteredProductions])

  // =========================================================
  // PRODUCTION TREND
  // =========================================================

  const productionTrend = useMemo(() => {
    const grouped = {}

    filteredProductions.forEach((item) => {
      const date = item.record_date

      if (!date) return

      if (!grouped[date]) {
        grouped[date] = {
          date,
          totalEggs: 0,
          goodEggs: 0,
          brokenEggs: 0,
          rejectedEggs: 0,
        }
      }

      grouped[date].totalEggs +=
        Number(item.total_eggs || 0)

      grouped[date].goodEggs +=
        Number(item.good_eggs || 0)

      grouped[date].brokenEggs +=
        Number(item.broken_eggs || 0)

      grouped[date].rejectedEggs +=
        Number(item.rejected_eggs || 0)
    })

    return Object.values(grouped)
      .sort(
        (a, b) =>
          new Date(a.date) -
          new Date(b.date)
      )
      .slice(-Number(period))
  }, [filteredProductions, period])

  const maxTrendEggs = useMemo(() => {
    return Math.max(
      ...productionTrend.map(
        (item) =>
          Number(item.totalEggs || 0)
      ),
      1
    )
  }, [productionTrend])

  // =========================================================
  // QUALITY ANALYSIS
  // =========================================================

  const quality = useMemo(() => {
    const total = summary.totalEggs

    if (total === 0) {
      return {
        good: 0,
        broken: 0,
        rejected: 0,
      }
    }

    return {
      good:
        (summary.goodEggs / total) *
        100,

      broken:
        (summary.brokenEggs / total) *
        100,

      rejected:
        (summary.rejectedEggs / total) *
        100,
    }
  }, [summary])

  // =========================================================
  // DEATHS BY TYPE
  // =========================================================

  const deathsByType = useMemo(() => {
    const grouped = {}

    filteredDeaths.forEach((item) => {
      const typeId =
        item.chicken_type_id || 'unknown'

      const typeName =
        item.chicken_types?.name ||
        'Tanpa Jenis'

      if (!grouped[typeId]) {
        grouped[typeId] = {
          id: typeId,
          name: typeName,
          deaths: 0,
        }
      }

      grouped[typeId].deaths +=
        Number(item.deaths || 0)
    })

    return Object.values(grouped)
      .sort(
        (a, b) =>
          b.deaths - a.deaths
      )
  }, [filteredDeaths])

  // =========================================================
  // PRODUCTIVITY
  // =========================================================

  const productivity = useMemo(() => {
    return productionByType.map((item) => {
      const population =
        currentPopulation.find(
          (populationItem) =>
            populationItem.id === item.id
        )?.population || 0

      const eggsPerChicken =
        population > 0
          ? item.averageDaily /
            population
          : 0

      const mortality =
        deathsByType.find(
          (deathItem) =>
            deathItem.id === item.id
        )?.deaths || 0

      const mortalityRate =
        population + mortality > 0
          ? (mortality /
              (population + mortality)) *
            100
          : 0

      return {
        ...item,
        population,
        eggsPerChicken,
        mortality,
        mortalityRate,
      }
    })
  }, [
    productionByType,
    currentPopulation,
    deathsByType,
  ])

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Analisis Produksi
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pantau produksi telur, kualitas, populasi, dan kematian ayam.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={filterType}
            onChange={(event) =>
              setFilterType(event.target.value)
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
          >
            <option value="all">
              Semua Jenis Ayam
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

          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value)
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
          >
            <option value="7">
              7 Hari
            </option>

            <option value="14">
              14 Hari
            </option>

            <option value="30">
              30 Hari
            </option>

            <option value="60">
              60 Hari
            </option>

            <option value="90">
              90 Hari
            </option>
          </select>
        </div>
      </div>

      {/* LOADING */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 text-sm text-slate-500">
            Memuat analisis produksi...
          </p>
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Produksi"
              value={formatNumber(summary.totalEggs)}
              suffix="butir"
              icon="🥚"
              type="red"
            />

            <StatCard
              title="Telur Baik"
              value={formatNumber(summary.goodEggs)}
              suffix={`${formatDecimal(
                summary.goodPercentage
              )}%`}
              icon="✓"
              type="green"
            />

            <StatCard
              title="Rata-rata Harian"
              value={formatNumber(
                Math.round(
                  summary.averageDaily
                )
              )}
              suffix="butir/hari"
              icon="📈"
              type="blue"
            />

            <StatCard
              title="Kematian"
              value={formatNumber(
                summary.totalDeaths
              )}
              suffix="ayam"
              icon="⚠️"
              type="orange"
            />
          </div>

          {/* TREND */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Tren Produksi Telur
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Perkembangan produksi berdasarkan tanggal pencatatan.
                  </p>
                </div>

                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                  {productionTrend.length} hari data
                </div>
              </div>
            </div>

            {productionTrend.length === 0 ? (
              <EmptyState text="Belum ada data produksi telur." />
            ) : (
              <div className="p-5">
                <div className="flex h-72 items-end gap-2 overflow-x-auto pb-8">
                  {productionTrend.map(
                    (item) => {
                      const height =
                        Math.max(
                          6,
                          (Number(
                            item.totalEggs
                          ) /
                            maxTrendEggs) *
                            100
                        )

                      return (
                        <div
                          key={item.date}
                          className="flex min-w-[44px] flex-1 flex-col items-center justify-end"
                        >
                          <div className="mb-2 text-[10px] font-semibold text-slate-500">
                            {formatNumber(
                              item.totalEggs
                            )}
                          </div>

                          <div className="flex h-48 w-full max-w-[42px] items-end rounded-t-lg bg-slate-100">
                            <div
                              className="w-full rounded-t-lg bg-red-500 transition-all hover:bg-red-600"
                              style={{
                                height: `${height}%`,
                              }}
                              title={`${formatDate(
                                item.date
                              )}: ${formatNumber(
                                item.totalEggs
                              )} telur`}
                            />
                          </div>

                          <div className="mt-2 whitespace-nowrap text-[10px] text-slate-400">
                            {shortDate(
                              item.date
                            )}
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              </div>
            )}
          </div>

          {/* QUALITY */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Kualitas Telur
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Perbandingan telur baik, pecah, dan ditolak.
                </p>
              </div>

              <div className="p-5">
                <div className="space-y-5">
                  <QualityRow
                    label="Telur Baik"
                    count={summary.goodEggs}
                    percentage={quality.good}
                    bar="bg-emerald-500"
                    text="text-emerald-600"
                  />

                  <QualityRow
                    label="Telur Pecah"
                    count={summary.brokenEggs}
                    percentage={quality.broken}
                    bar="bg-orange-500"
                    text="text-orange-600"
                  />

                  <QualityRow
                    label="Telur Ditolak"
                    count={summary.rejectedEggs}
                    percentage={quality.rejected}
                    bar="bg-red-500"
                    text="text-red-600"
                  />
                </div>
              </div>
            </div>

            {/* POPULATION */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Populasi Saat Ini
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Estimasi berdasarkan pencatatan populasi terakhir.
                </p>
              </div>

              <div className="p-5">
                <div className="mb-5 rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">
                    Total Populasi
                  </p>

                  <p className="mt-1 text-3xl font-bold text-slate-900">
                    {formatNumber(
                      totalCurrentPopulation
                    )}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    ekor ayam
                  </p>
                </div>

                {currentPopulation.length === 0 ? (
                  <p className="text-center text-sm text-slate-500">
                    Belum ada data populasi.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {currentPopulation
                      .sort(
                        (a, b) =>
                          b.population -
                          a.population
                      )
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">
                              {item.name}
                            </p>

                            <p className="text-xs text-slate-400">
                              Update{' '}
                              {formatDate(
                                item.recordDate
                              )}
                            </p>
                          </div>

                          <p className="font-bold text-slate-900">
                            {formatNumber(
                              item.population
                            )}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BY TYPE */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">
                Analisis Berdasarkan Jenis Ayam
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Perbandingan produksi dan produktivitas setiap jenis ayam.
              </p>
            </div>

            {productivity.length === 0 ? (
              <EmptyState text="Belum ada data produksi berdasarkan jenis ayam." />
            ) : (
              <>
                {/* DESKTOP */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200">
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Jenis Ayam
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Populasi
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Produksi
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Rata-rata
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Telur Baik
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Kematian
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Kualitas
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {productivity.map(
                        (item) => (
                          <tr
                            key={item.id}
                            className="transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <p className="font-semibold text-slate-900">
                                {item.name}
                              </p>

                              <p className="text-xs text-slate-400">
                                {item.records}{' '}
                                pencatatan
                              </p>
                            </td>

                            <td className="px-5 py-4 text-right font-semibold text-slate-700">
                              {formatNumber(
                                item.population
                              )}
                            </td>

                            <td className="px-5 py-4 text-right font-bold text-red-600">
                              {formatNumber(
                                item.totalEggs
                              )}
                            </td>

                            <td className="px-5 py-4 text-right text-sm text-slate-600">
                              {formatNumber(
                                Math.round(
                                  item.averageDaily
                                )
                              )}
                              /hari
                            </td>

                            <td className="px-5 py-4 text-right text-sm text-emerald-600">
                              {formatNumber(
                                item.goodEggs
                              )}
                            </td>

                            <td className="px-5 py-4 text-right text-sm text-orange-600">
                              {formatNumber(
                                item.mortality
                              )}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-600">
                                {formatDecimal(
                                  item.goodPercentage
                                )}
                                %
                              </span>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE */}
                <div className="divide-y divide-slate-100 lg:hidden">
                  {productivity.map(
                    (item) => (
                      <div
                        key={item.id}
                        className="p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              {item.name}
                            </h3>

                            <p className="mt-1 text-xs text-slate-400">
                              {item.records}{' '}
                              pencatatan
                            </p>
                          </div>

                          <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-600">
                            {formatDecimal(
                              item.goodPercentage
                            )}
                            %
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <AnalysisMiniCard
                            label="Populasi"
                            value={formatNumber(
                              item.population
                            )}
                          />

                          <AnalysisMiniCard
                            label="Produksi"
                            value={formatNumber(
                              item.totalEggs
                            )}
                          />

                          <AnalysisMiniCard
                            label="Rata-rata"
                            value={`${formatNumber(
                              Math.round(
                                item.averageDaily
                              )
                            )}/hari`}
                          />

                          <AnalysisMiniCard
                            label="Kematian"
                            value={formatNumber(
                              item.mortality
                            )}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          {/* DEATH ANALYSIS */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">
                Analisis Kematian
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Perbandingan jumlah kematian berdasarkan jenis ayam.
              </p>
            </div>

            {deathsByType.length === 0 ? (
              <EmptyState text="Belum ada data kematian ayam." />
            ) : (
              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
                {deathsByType.map(
                  (item) => {
                    const percentage =
                      summary.totalDeaths >
                      0
                        ? (item.deaths /
                            summary.totalDeaths) *
                          100
                        : 0

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-800">
                            {item.name}
                          </p>

                          <p className="font-bold text-red-600">
                            {formatNumber(
                              item.deaths
                            )}
                          </p>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{
                              width: `${Math.min(
                                percentage,
                                100
                              )}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-xs text-slate-400">
                          {formatDecimal(
                            percentage
                          )}
                          % dari total kematian
                        </p>
                      </div>
                    )
                  }
                )}
              </div>
            )}
          </div>

          {/* INSIGHT */}
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
            <div className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                💡
              </div>

              <div>
                <h2 className="font-bold text-red-900">
                  Ringkasan Produksi
                </h2>

                <div className="mt-2 space-y-1 text-sm text-red-800">
                  <p>
                    • Total produksi:{' '}
                    <strong>
                      {formatNumber(
                        summary.totalEggs
                      )}{' '}
                      butir
                    </strong>
                  </p>

                  <p>
                    • Rata-rata produksi:{' '}
                    <strong>
                      {formatNumber(
                        Math.round(
                          summary.averageDaily
                        )
                      )}{' '}
                      butir/hari
                    </strong>
                  </p>

                  <p>
                    • Kualitas telur baik:{' '}
                    <strong>
                      {formatDecimal(
                        summary.goodPercentage
                      )}
                      %
                    </strong>
                  </p>

                  <p>
                    • Total kematian:{' '}
                    <strong>
                      {formatNumber(
                        summary.totalDeaths
                      )}{' '}
                      ayam
                    </strong>
                  </p>

                  <p>
                    • Populasi terakhir tercatat:{' '}
                    <strong>
                      {formatNumber(
                        totalCurrentPopulation
                      )}{' '}
                      ayam
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// =========================================================
// STAT CARD
// =========================================================

function StatCard({
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${styles[type].value}`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {suffix}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${styles[type].icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

// =========================================================
// QUALITY ROW
// =========================================================

function QualityRow({
  label,
  count,
  percentage,
  bar,
  text,
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">
          {label}
        </span>

        <span
          className={`text-sm font-bold ${text}`}
        >
          {new Intl.NumberFormat(
            'id-ID'
          ).format(Number(count || 0))}{' '}
          ({Number(
            percentage || 0
          ).toLocaleString('id-ID', {
            maximumFractionDigits: 1,
          })}
          %)
        </span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${bar}`}
          style={{
            width: `${Math.min(
              Number(percentage || 0),
              100
            )}%`,
          }}
        />
      </div>
    </div>
  )
}

// =========================================================
// MINI CARD
// =========================================================

function AnalysisMiniCard({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="mt-1 font-bold text-slate-800">
        {value}
      </p>
    </div>
  )
}

// =========================================================
// EMPTY STATE
// =========================================================

function EmptyState({ text }) {
  return (
    <div className="p-10 text-center">
      <div className="text-4xl">
        📊
      </div>

      <p className="mt-3 text-sm text-slate-500">
        {text}
      </p>
    </div>
  )
}

export default ProductionAnalysis