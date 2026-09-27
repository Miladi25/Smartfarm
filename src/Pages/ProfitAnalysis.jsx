import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

const formatNumber = (value) =>
  new Intl.NumberFormat('id-ID').format(Number(value || 0))

const getTodayStart = () => {
  const now = new Date()

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  )
}

const getStartDate = (period) => {
  const start = getTodayStart()

  if (period === '7days') {
    start.setDate(start.getDate() - 6)
  }

  if (period === '30days') {
    start.setDate(start.getDate() - 29)
  }

  if (period === '90days') {
    start.setDate(start.getDate() - 89)
  }

  if (period === 'thisMonth') {
    start.setDate(1)
  }

  return start
}

const isDateInPeriod = (dateValue, period) => {
  if (period === 'all') return true

  if (!dateValue) return false

  const date = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(date.getTime())) return false

  return date >= getStartDate(period)
}

const periodLabels = {
  all: 'Semua Periode',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  '90days': '90 Hari Terakhir',
  thisMonth: 'Bulan Ini',
}

export default function ProfitAnalysis({ user }) {
  const [transactions, setTransactions] = useState([])
  const [chickenTypes, setChickenTypes] = useState([])
  const [production, setProduction] = useState([])
  const [deaths, setDeaths] = useState([])

  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [filterType, setFilterType] = useState('all')

  async function loadData() {
    setLoading(true)

    const [
      transactionResult,
      chickenTypeResult,
      productionResult,
      deathResult,
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select(`
          id,
          type,
          title,
          amount,
          transaction_date,
          category_id,
          chicken_type_id,
          categories (
            id,
            name,
            type
          ),
          chicken_types (
            id,
            name
          )
        `)
        .order('transaction_date', { ascending: true }),

      supabase
        .from('chicken_types')
        .select('id, name')
        .order('name'),

      supabase
        .from('egg_production')
        .select(`
          id,
          record_date,
          chicken_type_id,
          total_eggs,
          good_eggs,
          broken_eggs,
          rejected_eggs,
          chicken_types (
            id,
            name
          )
        `)
        .order('record_date', { ascending: true }),

      supabase
        .from('chicken_deaths')
        .select(`
          id,
          record_date,
          chicken_type_id,
          deaths,
          chicken_types (
            id,
            name
          )
        `)
        .order('record_date', { ascending: true }),
    ])

    if (transactionResult.error) {
      console.error(transactionResult.error)
      alert(
        `Gagal mengambil transaksi: ${transactionResult.error.message}`
      )
    }

    if (chickenTypeResult.error) {
      console.error(chickenTypeResult.error)
    }

    if (productionResult.error) {
      console.error(productionResult.error)
    }

    if (deathResult.error) {
      console.error(deathResult.error)
    }

    setTransactions(transactionResult.data || [])
    setChickenTypes(chickenTypeResult.data || [])
    setProduction(productionResult.data || [])
    setDeaths(deathResult.data || [])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const periodMatch = isDateInPeriod(
        item.transaction_date,
        period
      )

      const typeMatch =
        filterType === 'all' ||
        item.chicken_type_id === filterType

      return periodMatch && typeMatch
    })
  }, [transactions, period, filterType])

  const filteredProduction = useMemo(() => {
    return production.filter((item) => {
      const periodMatch = isDateInPeriod(
        item.record_date,
        period
      )

      const typeMatch =
        filterType === 'all' ||
        item.chicken_type_id === filterType

      return periodMatch && typeMatch
    })
  }, [production, period, filterType])

  const filteredDeaths = useMemo(() => {
    return deaths.filter((item) => {
      const periodMatch = isDateInPeriod(
        item.record_date,
        period
      )

      const typeMatch =
        filterType === 'all' ||
        item.chicken_type_id === filterType

      return periodMatch && typeMatch
    })
  }, [deaths, period, filterType])

  const financeSummary = useMemo(() => {
    const income = filteredTransactions
      .filter((item) => item.type === 'income')
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      )

    const expense = filteredTransactions
      .filter((item) => item.type === 'expense')
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      )

    const profit = income - expense

    const margin =
      income > 0
        ? (profit / income) * 100
        : 0

    return {
      income,
      expense,
      profit,
      margin,
      incomeCount: filteredTransactions.filter(
        (item) => item.type === 'income'
      ).length,
      expenseCount: filteredTransactions.filter(
        (item) => item.type === 'expense'
      ).length,
    }
  }, [filteredTransactions])

  const typeAnalysis = useMemo(() => {
    const map = {}

    chickenTypes.forEach((type) => {
      map[type.id] = {
        id: type.id,
        name: type.name,
        income: 0,
        expense: 0,
        profit: 0,
        incomeCount: 0,
        expenseCount: 0,
        eggs: 0,
        goodEggs: 0,
        brokenEggs: 0,
        rejectedEggs: 0,
        deaths: 0,
        productionRecords: 0,
        deathRecords: 0,
      }
    })

    filteredTransactions.forEach((item) => {
      if (!item.chicken_type_id) return

      if (!map[item.chicken_type_id]) {
        map[item.chicken_type_id] = {
          id: item.chicken_type_id,
          name:
            item.chicken_types?.name ||
            'Jenis Tidak Diketahui',
          income: 0,
          expense: 0,
          profit: 0,
          incomeCount: 0,
          expenseCount: 0,
          eggs: 0,
          goodEggs: 0,
          brokenEggs: 0,
          rejectedEggs: 0,
          deaths: 0,
          productionRecords: 0,
          deathRecords: 0,
        }
      }

      const amount = Number(item.amount || 0)

      if (item.type === 'income') {
        map[item.chicken_type_id].income += amount
        map[item.chicken_type_id].incomeCount += 1
      }

      if (item.type === 'expense') {
        map[item.chicken_type_id].expense += amount
        map[item.chicken_type_id].expenseCount += 1
      }
    })

    filteredProduction.forEach((item) => {
      if (!item.chicken_type_id) return

      if (!map[item.chicken_type_id]) {
        map[item.chicken_type_id] = {
          id: item.chicken_type_id,
          name:
            item.chicken_types?.name ||
            'Jenis Tidak Diketahui',
          income: 0,
          expense: 0,
          profit: 0,
          incomeCount: 0,
          expenseCount: 0,
          eggs: 0,
          goodEggs: 0,
          brokenEggs: 0,
          rejectedEggs: 0,
          deaths: 0,
          productionRecords: 0,
          deathRecords: 0,
        }
      }

      map[item.chicken_type_id].eggs +=
        Number(item.total_eggs || 0)

      map[item.chicken_type_id].goodEggs +=
        Number(item.good_eggs || 0)

      map[item.chicken_type_id].brokenEggs +=
        Number(item.broken_eggs || 0)

      map[item.chicken_type_id].rejectedEggs +=
        Number(item.rejected_eggs || 0)

      map[item.chicken_type_id].productionRecords += 1
    })

    filteredDeaths.forEach((item) => {
      if (!item.chicken_type_id) return

      if (!map[item.chicken_type_id]) {
        map[item.chicken_type_id] = {
          id: item.chicken_type_id,
          name:
            item.chicken_types?.name ||
            'Jenis Tidak Diketahui',
          income: 0,
          expense: 0,
          profit: 0,
          incomeCount: 0,
          expenseCount: 0,
          eggs: 0,
          goodEggs: 0,
          brokenEggs: 0,
          rejectedEggs: 0,
          deaths: 0,
          productionRecords: 0,
          deathRecords: 0,
        }
      }

      map[item.chicken_type_id].deaths +=
        Number(item.deaths || 0)

      map[item.chicken_type_id].deathRecords += 1
    })

    return Object.values(map)
      .map((item) => {
        const quality =
          item.eggs > 0
            ? (item.goodEggs / item.eggs) * 100
            : 0

        const margin =
          item.income > 0
            ? (item.profit / item.income) * 100
            : 0

        return {
          ...item,
          profit: item.income - item.expense,
          quality,
          margin,
        }
      })
      .filter(
        (item) =>
          item.income > 0 ||
          item.expense > 0 ||
          item.eggs > 0 ||
          item.deaths > 0
      )
      .sort((a, b) => b.profit - a.profit)
  }, [
    chickenTypes,
    filteredTransactions,
    filteredProduction,
    filteredDeaths,
  ])

  const generalTransactions = useMemo(() => {
    return filteredTransactions.filter(
      (item) => !item.chicken_type_id
    )
  }, [filteredTransactions])

  const generalFinance = useMemo(() => {
    const income = generalTransactions
      .filter((item) => item.type === 'income')
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      )

    const expense = generalTransactions
      .filter((item) => item.type === 'expense')
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      )

    return {
      income,
      expense,
      profit: income - expense,
    }
  }, [generalTransactions])

  const productionSummary = useMemo(() => {
    return filteredProduction.reduce(
      (acc, item) => {
        acc.eggs += Number(item.total_eggs || 0)
        acc.good += Number(item.good_eggs || 0)
        acc.broken += Number(item.broken_eggs || 0)
        acc.rejected += Number(item.rejected_eggs || 0)

        return acc
      },
      {
        eggs: 0,
        good: 0,
        broken: 0,
        rejected: 0,
      }
    )
  }, [filteredProduction])

  const totalDeaths = useMemo(() => {
    return filteredDeaths.reduce(
      (sum, item) =>
        sum + Number(item.deaths || 0),
      0
    )
  }, [filteredDeaths])

  const highestProfitType = useMemo(() => {
    if (!typeAnalysis.length) return null

    return typeAnalysis[0]
  }, [typeAnalysis])

  const chartData = useMemo(() => {
    const maxValue = Math.max(
      ...typeAnalysis.map((item) =>
        Math.max(
          item.income,
          item.expense,
          Math.abs(item.profit),
          1
        )
      ),
      1
    )

    return typeAnalysis.map((item) => ({
      ...item,
      incomeWidth:
        (item.income / maxValue) * 100,
      expenseWidth:
        (item.expense / maxValue) * 100,
      profitWidth:
        (Math.abs(item.profit) / maxValue) * 100,
    }))
  }, [typeAnalysis])

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="text-sm text-slate-500">
            Memuat analisis keuntungan...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
            📈
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Analisis Keuntungan
            </h1>

            <p className="text-sm text-slate-500">
              Analisis keuntungan Smart Farm berdasarkan periode dan jenis ayam
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          🔄 Refresh
        </button>
      </div>

      {/* FILTER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Periode
            </label>

            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">
                Semua Periode
              </option>

              <option value="7days">
                7 Hari Terakhir
              </option>

              <option value="30days">
                30 Hari Terakhir
              </option>

              <option value="90days">
                90 Hari Terakhir
              </option>

              <option value="thisMonth">
                Bulan Ini
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Jenis Ayam
            </label>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
            >
              <option value="all">
                Semua Jenis Ayam
              </option>

              {chickenTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          📅 Menampilkan data:
          <span className="ml-1 font-bold text-slate-900">
            {periodLabels[period]}
          </span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Pemasukan
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {formatCurrency(financeSummary.income)}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {financeSummary.incomeCount} transaksi
          </p>
        </div>

        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total Pengeluaran
          </p>

          <p className="mt-2 text-2xl font-bold text-red-600">
            {formatCurrency(financeSummary.expense)}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {financeSummary.expenseCount} transaksi
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Keuntungan Bersih
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${
              financeSummary.profit >= 0
                ? 'text-blue-600'
                : 'text-red-600'
            }`}
          >
            {formatCurrency(financeSummary.profit)}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            Margin {financeSummary.margin.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Produksi Telur
          </p>

          <p className="mt-2 text-2xl font-bold text-amber-600">
            {formatNumber(productionSummary.eggs)}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {formatNumber(totalDeaths)} kematian
          </p>
        </div>
      </div>

      {/* INSIGHT */}
      {highestProfitType && (
        <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm">

          <p className="text-sm font-medium text-slate-400">
            Ringkasan Data
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <h2 className="text-2xl font-bold">
                {highestProfitType.name}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Berdasarkan filter yang sedang digunakan,
                keuntungan tercatat untuk jenis ayam ini adalah{' '}
                <span className="font-bold text-white">
                  {formatCurrency(
                    highestProfitType.profit
                  )}
                </span>
                .
              </p>
            </div>

            <div className="rounded-xl bg-white/10 px-5 py-4">
              <p className="text-xs text-slate-400">
                Keuntungan
              </p>

              <p className="mt-1 text-xl font-bold">
                {formatCurrency(
                  highestProfitType.profit
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PROFIT PER JENIS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900">
            Keuntungan Berdasarkan Jenis Ayam
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Perbandingan pemasukan, pengeluaran, dan keuntungan.
          </p>
        </div>

        {typeAnalysis.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">

            <div className="text-4xl">
              🐔
            </div>

            <h3 className="mt-3 font-bold text-slate-900">
              Belum ada data berdasarkan jenis ayam
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Tambahkan pemasukan atau pengeluaran melalui menu
              Keuangan dan pilih jenis ayam agar keuntungan dapat
              dihitung secara otomatis.
            </p>
          </div>
        ) : (
          <div className="space-y-5">

            {chartData.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
              >

                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                      🐔
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900">
                        {item.name}
                      </h3>

                      <p className="text-xs text-slate-500">
                        {item.incomeCount +
                          item.expenseCount}{' '}
                        transaksi keuangan
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 sm:text-right">
                      Keuntungan Bersih
                    </p>

                    <p
                      className={`text-xl font-bold sm:text-right ${
                        item.profit >= 0
                          ? 'text-blue-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(item.profit)}
                    </p>
                  </div>
                </div>

                {/* PEMASUKAN */}
                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-emerald-700">
                      Pemasukan
                    </span>

                    <span className="text-slate-600">
                      {formatCurrency(item.income)}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{
                        width: `${Math.min(
                          item.incomeWidth,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* PENGELUARAN */}
                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-red-700">
                      Pengeluaran
                    </span>

                    <span className="text-slate-600">
                      {formatCurrency(item.expense)}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all duration-700"
                      style={{
                        width: `${Math.min(
                          item.expenseWidth,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* KEUNTUNGAN */}
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-blue-700">
                      Keuntungan
                    </span>

                    <span className="text-slate-600">
                      Margin {item.margin.toFixed(1)}%
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        item.profit >= 0
                          ? 'bg-blue-500'
                          : 'bg-orange-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          item.profitWidth,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETAIL */}
      {typeAnalysis.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Detail Per Jenis Ayam
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Ringkasan keuangan dan operasional berdasarkan jenis ayam.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

            {typeAnalysis.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >

                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl">
                    🐔
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900">
                      {item.name}
                    </h3>

                    <p className="text-xs text-slate-500">
                      Data dinamis Smart Farm
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">

                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">
                      Pemasukan
                    </span>

                    <span className="font-semibold text-emerald-600">
                      {formatCurrency(item.income)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">
                      Pengeluaran
                    </span>

                    <span className="font-semibold text-red-600">
                      {formatCurrency(item.expense)}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex justify-between gap-4">
                      <span className="font-semibold text-slate-700">
                        Keuntungan
                      </span>

                      <span
                        className={`font-bold ${
                          item.profit >= 0
                            ? 'text-blue-600'
                            : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(item.profit)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">
                      Margin
                    </span>

                    <span className="font-semibold text-slate-900">
                      {item.margin.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">
                      Produksi Telur
                    </span>

                    <span className="font-semibold text-amber-600">
                      {formatNumber(item.eggs)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">
                      Telur Baik
                    </span>

                    <span className="font-semibold text-emerald-600">
                      {formatNumber(item.goodEggs)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-sm text-slate-500">
                      Kematian
                    </span>

                    <span className="font-semibold text-red-600">
                      {formatNumber(item.deaths)}
                    </span>
                  </div>

                  <div className="pt-2">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500">
                        Kualitas Telur
                      </span>

                      <span className="font-semibold text-slate-700">
                        {item.quality.toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{
                          width: `${Math.min(
                            item.quality,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSAKSI UMUM */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            Transaksi Umum
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Transaksi yang tidak dikaitkan dengan jenis ayam tertentu.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-2xl bg-emerald-50 p-5">
            <p className="text-sm text-emerald-700">
              Pemasukan Umum
            </p>

            <p className="mt-2 text-xl font-bold text-emerald-700">
              {formatCurrency(generalFinance.income)}
            </p>
          </div>

          <div className="rounded-2xl bg-red-50 p-5">
            <p className="text-sm text-red-700">
              Pengeluaran Umum
            </p>

            <p className="mt-2 text-xl font-bold text-red-700">
              {formatCurrency(generalFinance.expense)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-600">
              Selisih Umum
            </p>

            <p
              className={`mt-2 text-xl font-bold ${
                generalFinance.profit >= 0
                  ? 'text-blue-600'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(generalFinance.profit)}
            </p>
          </div>

        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
          💡 Transaksi umum tetap masuk ke total keuntungan keseluruhan,
          tetapi tidak dimasukkan ke perhitungan keuntungan jenis ayam.
        </div>
      </div>

      {/* PRODUKSI & KEMATIAN */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="text-lg font-bold text-slate-900">
            Produksi Telur
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3">

            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-amber-700">
                Total
              </p>

              <p className="mt-1 text-xl font-bold text-amber-700">
                {formatNumber(productionSummary.eggs)}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">
                Telur Baik
              </p>

              <p className="mt-1 text-xl font-bold text-emerald-700">
                {formatNumber(productionSummary.good)}
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 p-4">
              <p className="text-xs text-orange-700">
                Pecah
              </p>

              <p className="mt-1 text-xl font-bold text-orange-700">
                {formatNumber(productionSummary.broken)}
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs text-red-700">
                Ditolak
              </p>

              <p className="mt-1 text-xl font-bold text-red-700">
                {formatNumber(productionSummary.rejected)}
              </p>
            </div>

          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="text-lg font-bold text-slate-900">
            Kematian Ayam
          </h2>

          <div className="mt-5 rounded-2xl bg-red-50 p-6">

            <p className="text-sm text-red-700">
              Total kematian pada periode
            </p>

            <p className="mt-2 text-4xl font-bold text-red-700">
              {formatNumber(totalDeaths)}
            </p>

            <p className="mt-2 text-sm text-red-600">
              Berdasarkan data kematian yang terkait dengan
              filter jenis ayam.
            </p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">

        <p className="text-sm font-semibold text-slate-700">
          Smart Farm • Analisis Keuntungan
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Keuntungan dihitung dari pemasukan dikurangi pengeluaran
          berdasarkan periode dan jenis ayam.
        </p>
      </div>

    </div>
  )
}