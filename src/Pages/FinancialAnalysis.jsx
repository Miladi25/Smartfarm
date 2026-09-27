import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// =========================================================
// DATE HELPER
// =========================================================

function formatDate(date) {
  if (!date) return '-'

  const parsedDate = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return '-'
  }

  return parsedDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function FinancialAnalysis({ user, farm }) {
  const [transactions, setTransactions] = useState([])
  const [debts, setDebts] = useState([])
  const [receivables, setReceivables] = useState([])
  const [chickenTypes, setChickenTypes] = useState([])

  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [period, setPeriod] = useState('30')

  const isSuperAdmin = user?.is_super_admin === true
  const currentFarmId =
    farm?.farmId || user?.farm_id || null

  // =========================================================
  // HELPERS
  // =========================================================

  const formatNumber = (value) => {
    return new Intl.NumberFormat('id-ID').format(
      Number(value || 0)
    )
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0))
  }

  const formatShortCurrency = (value) => {
    const number = Number(value || 0)

    if (number >= 1000000000) {
      return `Rp ${(number / 1000000000).toLocaleString(
        'id-ID',
        {
          maximumFractionDigits: 1,
        }
      )} M`
    }

    if (number >= 1000000) {
      return `Rp ${(number / 1000000).toLocaleString(
        'id-ID',
        {
          maximumFractionDigits: 1,
        }
      )} Jt`
    }

    if (number >= 1000) {
      return `Rp ${(number / 1000).toLocaleString(
        'id-ID',
        {
          maximumFractionDigits: 1,
        }
      )} Rb`
    }

    return `Rp ${formatNumber(number)}`
  }

  const formatDecimal = (value, digits = 1) => {
    return Number(value || 0).toLocaleString('id-ID', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
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

      let transactionQuery = supabase
        .from('transactions')
        .select(`
          id,
          type,
          title,
          amount,
          chicken_type_id,
          transaction_date,
          farm_id,
          chicken_types (
            id,
            name
          )
        `)
        .order('transaction_date', {
          ascending: true,
        })

      let debtQuery = supabase
        .from('debts')
        .select('*')

      let receivableQuery = supabase
        .from('receivables')
        .select('*')

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
        transactionQuery =
          transactionQuery.eq(
            'farm_id',
            currentFarmId
          )

        debtQuery = debtQuery.eq(
          'farm_id',
          currentFarmId
        )

        receivableQuery =
          receivableQuery.eq(
            'farm_id',
            currentFarmId
          )

        typeQuery = typeQuery.eq(
          'farm_id',
          currentFarmId
        )
      }

      const [
        transactionResult,
        debtResult,
        receivableResult,
        typeResult,
      ] = await Promise.all([
        transactionQuery,
        debtQuery,
        receivableQuery,
        typeQuery,
      ])

      if (transactionResult.error) {
        throw transactionResult.error
      }

      if (debtResult.error) {
        throw debtResult.error
      }

      if (receivableResult.error) {
        throw receivableResult.error
      }

      if (typeResult.error) {
        throw typeResult.error
      }

      setTransactions(
        transactionResult.data || []
      )

      setDebts(debtResult.data || [])
      setReceivables(
        receivableResult.data || []
      )

      setChickenTypes(
        typeResult.data || []
      )
    } catch (error) {
      console.error(
        'Gagal mengambil data analisis keuangan:',
        error
      )

      alert(
        `Gagal mengambil data analisis keuangan: ${error.message}`
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
  // FILTER TRANSACTIONS
  // =========================================================

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      if (filterType === 'all') {
        return true
      }

      return (
        item.chicken_type_id ===
        filterType
      )
    })
  }, [
    transactions,
    filterType,
  ])

  // =========================================================
  // SUMMARY
  // =========================================================

  const summary = useMemo(() => {
    const income =
      filteredTransactions
        .filter(
          (item) =>
            item.type === 'income' ||
            item.type === 'pemasukan'
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(item.amount || 0),
          0
        )

    const expense =
      filteredTransactions
        .filter(
          (item) =>
            item.type === 'expense' ||
            item.type === 'pengeluaran'
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(item.amount || 0),
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
      totalTransactions:
        filteredTransactions.length,
    }
  }, [filteredTransactions])

  // =========================================================
  // DEBT / RECEIVABLE TOTAL
  // =========================================================

  const getAmount = (item) => {
    const possibleFields = [
      'amount',
      'nominal',
      'total',
      'remaining_amount',
      'remaining',
      'sisa',
    ]

    for (const field of possibleFields) {
      if (
        item?.[field] !== undefined &&
        item?.[field] !== null
      ) {
        return Number(item[field]) || 0
      }
    }

    return 0
  }

  const debtTotal = useMemo(() => {
    return debts.reduce(
      (sum, item) =>
        sum + getAmount(item),
      0
    )
  }, [debts])

  const receivableTotal = useMemo(() => {
    return receivables.reduce(
      (sum, item) =>
        sum + getAmount(item),
      0
    )
  }, [receivables])

  // =========================================================
  // TRANSACTION TREND
  // =========================================================

  const financialTrend = useMemo(() => {
    const grouped = {}

    filteredTransactions.forEach(
      (item) => {
        const date =
          item.transaction_date

        if (!date) return

        if (!grouped[date]) {
          grouped[date] = {
            date,
            income: 0,
            expense: 0,
            profit: 0,
          }
        }

        const amount =
          Number(item.amount || 0)

        if (
          item.type === 'income' ||
          item.type === 'pemasukan'
        ) {
          grouped[date].income += amount
        }

        if (
          item.type === 'expense' ||
          item.type === 'pengeluaran'
        ) {
          grouped[date].expense += amount
        }

        grouped[date].profit =
          grouped[date].income -
          grouped[date].expense
      }
    )

    return Object.values(grouped)
      .sort(
        (a, b) =>
          new Date(a.date) -
          new Date(b.date)
      )
      .slice(-Number(period))
  }, [
    filteredTransactions,
    period,
  ])

  const maxFinancialValue = useMemo(() => {
    return Math.max(
      ...financialTrend.flatMap(
        (item) => [
          item.income,
          item.expense,
        ]
      ),
      1
    )
  }, [financialTrend])

  // =========================================================
  // BY CHICKEN TYPE
  // =========================================================

  const financialByType = useMemo(() => {
    const grouped = {}

    filteredTransactions.forEach(
      (item) => {
        const typeId =
          item.chicken_type_id ||
          'unknown'

        const typeName =
          item.chicken_types?.name ||
          'Tanpa Jenis'

        if (!grouped[typeId]) {
          grouped[typeId] = {
            id: typeId,
            name: typeName,
            income: 0,
            expense: 0,
            profit: 0,
            transactions: 0,
          }
        }

        const amount =
          Number(item.amount || 0)

        if (
          item.type === 'income' ||
          item.type === 'pemasukan'
        ) {
          grouped[typeId].income +=
            amount
        }

        if (
          item.type === 'expense' ||
          item.type === 'pengeluaran'
        ) {
          grouped[typeId].expense +=
            amount
        }

        grouped[typeId].transactions +=
          1
      }
    )

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        profit:
          item.income - item.expense,

        margin:
          item.income > 0
            ? ((item.income -
                item.expense) /
                item.income) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.profit - a.profit
      )
  }, [filteredTransactions])

  // =========================================================
  // EXPENSE / INCOME CATEGORIES
  // =========================================================

  const incomeTransactions =
    useMemo(() => {
      return filteredTransactions
        .filter(
          (item) =>
            item.type === 'income' ||
            item.type === 'pemasukan'
        )
        .sort(
          (a, b) =>
            Number(b.amount || 0) -
            Number(a.amount || 0)
        )
    }, [filteredTransactions])

  const expenseTransactions =
    useMemo(() => {
      return filteredTransactions
        .filter(
          (item) =>
            item.type === 'expense' ||
            item.type === 'pengeluaran'
        )
        .sort(
          (a, b) =>
            Number(b.amount || 0) -
            Number(a.amount || 0)
        )
    }, [filteredTransactions])

  // =========================================================
  // TOP TRANSACTIONS
  // =========================================================

  const latestTransactions = useMemo(() => {
    return [...filteredTransactions]
      .sort(
        (a, b) =>
          new Date(
            b.transaction_date
          ) -
          new Date(
            a.transaction_date
          )
      )
      .slice(0, 8)
  }, [filteredTransactions])

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Analisis Keuangan
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pantau pemasukan, pengeluaran, laba, dan kondisi keuangan peternakan.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={filterType}
            onChange={(event) =>
              setFilterType(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
            value={period}
            onChange={(event) =>
              setPeriod(
                event.target.value
              )
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

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

          <p className="mt-4 text-sm text-slate-500">
            Memuat analisis keuangan...
          </p>
        </div>
      ) : (
        <>
          {/* SUMMARY */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Pemasukan"
              value={formatShortCurrency(
                summary.income
              )}
              detail={formatCurrency(
                summary.income
              )}
              icon="💰"
              type="green"
            />

            <StatCard
              title="Total Pengeluaran"
              value={formatShortCurrency(
                summary.expense
              )}
              detail={formatCurrency(
                summary.expense
              )}
              icon="💸"
              type="red"
            />

            <StatCard
              title="Laba Bersih"
              value={formatShortCurrency(
                summary.profit
              )}
              detail={`${formatDecimal(
                summary.margin
              )}% margin`}
              icon="📈"
              type={
                summary.profit >= 0
                  ? 'blue'
                  : 'orange'
              }
            />

            <StatCard
              title="Transaksi"
              value={formatNumber(
                summary.totalTransactions
              )}
              detail="total pencatatan"
              icon="🧾"
              type="purple"
            />
          </div>

          {/* DEBT / RECEIVABLE */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FinancialBalanceCard
              title="Hutang Berjalan"
              amount={debtTotal}
              icon="📕"
              type="red"
            />

            <FinancialBalanceCard
              title="Piutang Berjalan"
              amount={receivableTotal}
              icon="📗"
              type="green"
            />
          </div>

          {/* PROFIT OVERVIEW */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Ringkasan Arus Keuangan
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Perbandingan pemasukan dan pengeluaran berdasarkan tanggal.
                </p>
              </div>

              {financialTrend.length ===
              0 ? (
                <EmptyState text="Belum ada data transaksi keuangan." />
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex min-w-[650px] items-end gap-3">
                    {financialTrend.map(
                      (item) => {
                        const incomeHeight =
                          Math.max(
                            4,
                            (item.income /
                              maxFinancialValue) *
                              100
                          )

                        const expenseHeight =
                          Math.max(
                            4,
                            (item.expense /
                              maxFinancialValue) *
                              100
                          )

                        return (
                          <div
                            key={item.date}
                            className="flex min-w-[58px] flex-1 flex-col items-center"
                          >
                            <div className="mb-2 flex h-48 items-end gap-1">
                              <div
                                className="w-5 rounded-t-md bg-emerald-500"
                                style={{
                                  height: `${incomeHeight}%`,
                                }}
                                title={`Pemasukan ${formatCurrency(
                                  item.income
                                )}`}
                              />

                              <div
                                className="w-5 rounded-t-md bg-red-500"
                                style={{
                                  height: `${expenseHeight}%`,
                                }}
                                title={`Pengeluaran ${formatCurrency(
                                  item.expense
                                )}`}
                              />
                            </div>

                            <span className="text-[10px] text-slate-400">
                              {shortDate(
                                item.date
                              )}
                            </span>
                          </div>
                        )
                      }
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-6 text-xs">
                    <Legend
                      label="Pemasukan"
                      className="bg-emerald-500"
                    />

                    <Legend
                      label="Pengeluaran"
                      className="bg-red-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* MARGIN */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Margin Keuntungan
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Persentase laba terhadap total pemasukan.
              </p>

              <div className="mt-8 flex justify-center">
                <div className="relative flex h-48 w-48 items-center justify-center rounded-full border-[18px] border-slate-100">
                  <div
                    className="absolute inset-[-18px] rounded-full"
                    style={{
                      background: `conic-gradient(
                        #10b981 ${
                          Math.min(
                            Math.max(
                              summary.margin,
                              0
                            ),
                            100
                          )
                        }%,
                        transparent 0
                      )`,
                      mask:
                        'radial-gradient(farthest-side, transparent calc(100% - 18px), #000 0)',
                      WebkitMask:
                        'radial-gradient(farthest-side, transparent calc(100% - 18px), #000 0)',
                    }}
                  />

                  <div className="text-center">
                    <p
                      className={`text-4xl font-bold ${
                        summary.profit >=
                        0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatDecimal(
                        summary.margin
                      )}
                      %
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      margin
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <SummaryLine
                  label="Pemasukan"
                  value={formatCurrency(
                    summary.income
                  )}
                />

                <SummaryLine
                  label="Pengeluaran"
                  value={formatCurrency(
                    summary.expense
                  )}
                />

                <SummaryLine
                  label="Laba Bersih"
                  value={formatCurrency(
                    summary.profit
                  )}
                  highlight
                />
              </div>
            </div>
          </div>

          {/* BY CHICKEN TYPE */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">
                Keuangan Berdasarkan Jenis Ayam
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Perbandingan pemasukan dan pengeluaran setiap jenis ayam.
              </p>
            </div>

            {financialByType.length ===
            0 ? (
              <EmptyState text="Belum ada transaksi yang terhubung dengan jenis ayam." />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200">
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Jenis Ayam
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Pemasukan
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Pengeluaran
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Laba
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Margin
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {financialByType.map(
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
                                {
                                  item.transactions
                                }{' '}
                                transaksi
                              </p>
                            </td>

                            <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                              {formatCurrency(
                                item.income
                              )}
                            </td>

                            <td className="px-5 py-4 text-right font-semibold text-red-600">
                              {formatCurrency(
                                item.expense
                              )}
                            </td>

                            <td
                              className={`px-5 py-4 text-right font-bold ${
                                item.profit >=
                                0
                                  ? 'text-blue-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {formatCurrency(
                                item.profit
                              )}
                            </td>

                            <td className="px-5 py-4 text-right">
                              <span
                                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                                  item.margin >=
                                  0
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-red-50 text-red-600'
                                }`}
                              >
                                {formatDecimal(
                                  item.margin
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

                <div className="divide-y divide-slate-100 lg:hidden">
                  {financialByType.map(
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
                              {
                                item.transactions
                              }{' '}
                              transaksi
                            </p>
                          </div>

                          <span
                            className={`rounded-lg px-3 py-2 text-sm font-bold ${
                              item.margin >=
                              0
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {formatDecimal(
                              item.margin
                            )}
                            %
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <MoneyMiniCard
                            label="Pemasukan"
                            value={
                              item.income
                            }
                            type="green"
                          />

                          <MoneyMiniCard
                            label="Pengeluaran"
                            value={
                              item.expense
                            }
                            type="red"
                          />

                          <MoneyMiniCard
                            label="Laba"
                            value={
                              item.profit
                            }
                            type={
                              item.profit >=
                              0
                                ? 'blue'
                                : 'red'
                            }
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          {/* TOP INCOME / EXPENSE */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TransactionRanking
              title="Pemasukan Terbesar"
              description="Transaksi pemasukan dengan nominal terbesar."
              items={incomeTransactions}
              type="income"
              formatCurrency={
                formatCurrency
              }
            />

            <TransactionRanking
              title="Pengeluaran Terbesar"
              description="Transaksi pengeluaran dengan nominal terbesar."
              items={expenseTransactions}
              type="expense"
              formatCurrency={
                formatCurrency
              }
            />
          </div>

          {/* LATEST TRANSACTIONS */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-bold text-slate-900">
                Transaksi Terbaru
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Ringkasan transaksi keuangan terbaru.
              </p>
            </div>

            {latestTransactions.length ===
            0 ? (
              <EmptyState text="Belum ada transaksi keuangan." />
            ) : (
              <div className="divide-y divide-slate-100">
                {latestTransactions.map(
                  (item) => {
                    const isIncome =
                      item.type ===
                        'income' ||
                      item.type ===
                        'pemasukan'

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              isIncome
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {isIncome
                              ? '↓'
                              : '↑'}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.title ||
                                'Transaksi'}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {formatDate(
                                item.transaction_date
                              )}
                              {' • '}
                              {item
                                .chicken_types
                                ?.name ||
                                'Tanpa Jenis'}
                            </p>
                          </div>
                        </div>

                        <p
                          className={`font-bold ${
                            isIncome
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {isIncome
                            ? '+'
                            : '-'}
                          {formatCurrency(
                            item.amount
                          )}
                        </p>
                      </div>
                    )
                  }
                )}
              </div>
            )}
          </div>

          {/* FOOTER SUMMARY */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <SummaryBox
                label="Pemasukan"
                value={formatCurrency(
                  summary.income
                )}
                icon="💰"
                type="green"
              />

              <SummaryBox
                label="Pengeluaran"
                value={formatCurrency(
                  summary.expense
                )}
                icon="💸"
                type="red"
              />

              <SummaryBox
                label="Laba Bersih"
                value={formatCurrency(
                  summary.profit
                )}
                icon="📊"
                type={
                  summary.profit >=
                  0
                    ? 'blue'
                    : 'red'
                }
              />
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
  detail,
  icon,
  type,
}) {
  const styles = {
    green: {
      icon: 'bg-emerald-50 text-emerald-600',
      value: 'text-emerald-600',
    },

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

    purple: {
      icon: 'bg-purple-50 text-purple-600',
      value: 'text-purple-600',
    },
  }

  const selected =
    styles[type] || styles.blue

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p
            className={`mt-2 truncate text-2xl font-bold ${selected.value}`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {detail}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${selected.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

// =========================================================
// BALANCE CARD
// =========================================================

function FinancialBalanceCard({
  title,
  amount,
  icon,
  type,
}) {
  const isGreen = type === 'green'

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        isGreen
          ? 'border-emerald-100 bg-emerald-50/50'
          : 'border-red-100 bg-red-50/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p
            className={`mt-2 text-2xl font-bold ${
              isGreen
                ? 'text-emerald-600'
                : 'text-red-600'
            }`}
          >
            {new Intl.NumberFormat(
              'id-ID',
              {
                style: 'currency',
                currency: 'IDR',
                maximumFractionDigits: 0,
              }
            ).format(
              Number(amount || 0)
            )}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white text-xl shadow-sm`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

// =========================================================
// LEGEND
// =========================================================

function Legend({
  label,
  className,
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-3 w-3 rounded-full ${className}`}
      />

      <span className="text-slate-500">
        {label}
      </span>
    </div>
  )
}

// =========================================================
// SUMMARY LINE
// =========================================================

function SummaryLine({
  label,
  value,
  highlight = false,
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        highlight
          ? 'border-t border-slate-200 pt-3'
          : ''
      }`}
    >
      <span
        className={`text-sm ${
          highlight
            ? 'font-semibold text-slate-800'
            : 'text-slate-500'
        }`}
      >
        {label}
      </span>

      <span
        className={`text-sm font-bold ${
          highlight
            ? 'text-emerald-600'
            : 'text-slate-800'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

// =========================================================
// MONEY MINI CARD
// =========================================================

function MoneyMiniCard({
  label,
  value,
  type,
}) {
  const styles = {
    green:
      'bg-emerald-50 text-emerald-600',

    red:
      'bg-red-50 text-red-600',

    blue:
      'bg-blue-50 text-blue-600',
  }

  return (
    <div
      className={`rounded-xl p-3 ${styles[type]}`}
    >
      <p className="text-xs opacity-70">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold">
        {new Intl.NumberFormat(
          'id-ID',
          {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0,
          }
        ).format(Number(value || 0))}
      </p>
    </div>
  )
}

// =========================================================
// TRANSACTION RANKING
// =========================================================

function TransactionRanking({
  title,
  description,
  items,
  type,
  formatCurrency,
}) {
  const isIncome = type === 'income'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState text="Belum ada data." />
      ) : (
        <div className="divide-y divide-slate-100">
          {items
            .slice(0, 5)
            .map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-4"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isIncome
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.title ||
                      'Transaksi'}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(
                      item.transaction_date
                    )}
                  </p>
                </div>

                <p
                  className={`shrink-0 text-sm font-bold ${
                    isIncome
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }`}
                >
                  {formatCurrency(
                    item.amount
                  )}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// =========================================================
// SUMMARY BOX
// =========================================================

function SummaryBox({
  label,
  value,
  icon,
  type,
}) {
  const styles = {
    green:
      'bg-emerald-50 text-emerald-600',

    red:
      'bg-red-50 text-red-600',

    blue:
      'bg-blue-50 text-blue-600',
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-100 p-4">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${styles[type]}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-sm text-slate-500">
          {label}
        </p>

        <p className="mt-1 break-words text-lg font-bold text-slate-900">
          {value}
        </p>
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

export default FinancialAnalysis