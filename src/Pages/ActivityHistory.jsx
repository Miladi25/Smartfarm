import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function ActivityHistory({ user }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadActivities()
  }, [user])

  const loadActivities = async () => {
    try {
      setLoading(true)
      setError('')

      const [
        transactionsResult,
        debtsResult,
        receivablesResult,
        populationResult,
        productionResult,
        deathsResult,
        feedResult,
        inventoryResult,
        customersResult,
        suppliersResult,
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select(
            'id, type, title, amount, transaction_date, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('debts')
          .select(
            'id, title, amount, paid_amount, due_date, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('receivables')
          .select(
            'id, title, amount, received_amount, due_date, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('chicken_population')
          .select(
            'id, record_date, initial_population, incoming, outgoing, deaths, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('egg_production')
          .select(
            'id, record_date, total_eggs, good_eggs, broken_eggs, rejected_eggs, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('chicken_deaths')
          .select(
            'id, record_date, deaths, cause, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('feed_stock')
          .select(
            'id, record_date, feed_name, quantity, unit, minimum_stock, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('inventory')
          .select(
            'id, record_date, item_name, quantity, unit, minimum_stock, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('customers')
          .select(
            'id, name, phone, customer_type, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('suppliers')
          .select(
            'id, name, phone, supplier_type, created_at'
          )
          .order('created_at', {
            ascending: false,
          }),
      ])

      const results = [
        transactionsResult,
        debtsResult,
        receivablesResult,
        populationResult,
        productionResult,
        deathsResult,
        feedResult,
        inventoryResult,
        customersResult,
        suppliersResult,
      ]

      const failed = results.find(
        (result) => result.error
      )

      if (failed) {
        console.error(
          'Activity history error:',
          failed.error
        )
      }

      const generatedActivities = []

      const addActivity = ({
        id,
        category,
        icon,
        title,
        description,
        date,
        timestamp,
      }) => {
        generatedActivities.push({
          id,
          category,
          icon,
          title,
          description,
          date,
          timestamp:
            timestamp ||
            date ||
            new Date().toISOString(),
        })
      }

      // TRANSACTIONS
      ;(transactionsResult.data || []).forEach(
        (item) => {
          const isIncome =
            item.type === 'income'

          addActivity({
            id: `transaction-${item.id}`,
            category: isIncome
              ? 'income'
              : 'expense',
            icon: isIncome ? '💰' : '💸',
            title: isIncome
              ? 'Pemasukan dicatat'
              : 'Pengeluaran dicatat',
            description: `${item.title} • ${formatCurrency(
              item.amount
            )}`,
            date: item.transaction_date,
            timestamp: item.created_at,
          })
        }
      )

      // DEBTS
      ;(debtsResult.data || []).forEach(
        (item) => {
          addActivity({
            id: `debt-${item.id}`,
            category: 'debt',
            icon: '📕',
            title: 'Hutang dicatat',
            description: `${item.title} • ${formatCurrency(
              item.amount
            )}`,
            date: item.due_date,
            timestamp: item.created_at,
          })
        }
      )

      // RECEIVABLES
      ;(receivablesResult.data || []).forEach(
        (item) => {
          addActivity({
            id: `receivable-${item.id}`,
            category: 'receivable',
            icon: '📗',
            title: 'Piutang dicatat',
            description: `${item.title} • ${formatCurrency(
              item.amount
            )}`,
            date: item.due_date,
            timestamp: item.created_at,
          })
        }
      )

      // POPULATION
      ;(populationResult.data || []).forEach(
        (item) => {
          const currentPopulation =
            Number(
              item.initial_population || 0
            ) +
            Number(item.incoming || 0) -
            Number(item.outgoing || 0) -
            Number(item.deaths || 0)

          addActivity({
            id: `population-${item.id}`,
            category: 'population',
            icon: '🐔',
            title: 'Populasi ayam dicatat',
            description: `Populasi saat pencatatan: ${currentPopulation.toLocaleString(
              'id-ID'
            )} ekor`,
            date: item.record_date,
            timestamp: item.created_at,
          })
        }
      )

      // EGG PRODUCTION
      ;(productionResult.data || []).forEach(
        (item) => {
          addActivity({
            id: `production-${item.id}`,
            category: 'production',
            icon: '🥚',
            title: 'Produksi telur dicatat',
            description: `Total ${Number(
              item.total_eggs || 0
            ).toLocaleString(
              'id-ID'
            )} telur • Baik ${Number(
              item.good_eggs || 0
            ).toLocaleString(
              'id-ID'
            )}`,
            date: item.record_date,
            timestamp: item.created_at,
          })
        }
      )

      // DEATHS
      ;(deathsResult.data || []).forEach(
        (item) => {
          addActivity({
            id: `death-${item.id}`,
            category: 'death',
            icon: '🐔',
            title: 'Kematian ayam dicatat',
            description: `${Number(
              item.deaths || 0
            ).toLocaleString(
              'id-ID'
            )} ekor${
              item.cause
                ? ` • ${item.cause}`
                : ''
            }`,
            date: item.record_date,
            timestamp: item.created_at,
          })
        }
      )

      // FEED STOCK
      ;(feedResult.data || []).forEach(
        (item) => {
          const lowStock =
            Number(item.quantity || 0) <=
            Number(
              item.minimum_stock || 0
            )

          addActivity({
            id: `feed-${item.id}`,
            category: 'feed',
            icon: '🌾',
            title: lowStock
              ? 'Stok pakan menipis'
              : 'Stok pakan dicatat',
            description: `${item.feed_name} • ${Number(
              item.quantity || 0
            ).toLocaleString(
              'id-ID'
            )} ${item.unit || 'kg'}`,
            date: item.record_date,
            timestamp: item.created_at,
          })
        }
      )

      // INVENTORY
      ;(inventoryResult.data || []).forEach(
        (item) => {
          const lowStock =
            Number(item.quantity || 0) <=
            Number(
              item.minimum_stock || 0
            )

          addActivity({
            id: `inventory-${item.id}`,
            category: 'inventory',
            icon: '📦',
            title: lowStock
              ? 'Stok barang menipis'
              : 'Stok barang dicatat',
            description: `${item.item_name} • ${Number(
              item.quantity || 0
            ).toLocaleString(
              'id-ID'
            )} ${item.unit || 'pcs'}`,
            date: item.record_date,
            timestamp: item.created_at,
          })
        }
      )

      // CUSTOMERS
      ;(customersResult.data || []).forEach(
        (item) => {
          addActivity({
            id: `customer-${item.id}`,
            category: 'customer',
            icon: '👥',
            title: 'Pelanggan ditambahkan',
            description: `${item.name}${
              item.customer_type
                ? ` • ${item.customer_type}`
                : ''
            }`,
            timestamp: item.created_at,
          })
        }
      )

      // SUPPLIERS
      ;(suppliersResult.data || []).forEach(
        (item) => {
          addActivity({
            id: `supplier-${item.id}`,
            category: 'supplier',
            icon: '🚚',
            title: 'Supplier ditambahkan',
            description: `${item.name}${
              item.supplier_type
                ? ` • ${item.supplier_type}`
                : ''
            }`,
            timestamp: item.created_at,
          })
        }
      )

      generatedActivities.sort(
        (a, b) =>
          new Date(b.timestamp) -
          new Date(a.timestamp)
      )

      setActivities(
        generatedActivities
      )
    } catch (err) {
      console.error(err)
      setError(
        'Gagal memuat riwayat aktivitas.'
      )
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat(
      'id-ID',
      {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }
    ).format(Number(value || 0))
  }

  const formatDate = (value) => {
    if (!value) return '-'

    const date = new Date(
      value.includes('T')
        ? value
        : `${value}T00:00:00`
    )

    if (Number.isNaN(date.getTime())) {
      return '-'
    }

    return date.toLocaleDateString(
      'id-ID',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }
    )
  }

  const formatDateTime = (value) => {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return '-'
    }

    return date.toLocaleString(
      'id-ID',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    )
  }

  const filteredActivities = useMemo(() => {
    const keyword =
      search.trim().toLowerCase()

    return activities.filter(
      (activity) => {
        const matchesType =
          filterType === 'all' ||
          activity.category ===
            filterType

        const matchesSearch =
          !keyword ||
          activity.title
            .toLowerCase()
            .includes(keyword) ||
          activity.description
            .toLowerCase()
            .includes(keyword)

        return (
          matchesType &&
          matchesSearch
        )
      }
    )
  }, [
    activities,
    filterType,
    search,
  ])

  const stats = useMemo(() => {
    return {
      total: activities.length,
      financial: activities.filter(
        (item) =>
          item.category === 'income' ||
          item.category === 'expense' ||
          item.category === 'debt' ||
          item.category ===
            'receivable'
      ).length,
      farm: activities.filter(
        (item) =>
          item.category ===
            'population' ||
          item.category ===
            'production' ||
          item.category === 'death'
      ).length,
      stock: activities.filter(
        (item) =>
          item.category === 'feed' ||
          item.category ===
            'inventory'
      ).length,
    }
  }, [activities])

  const categoryOptions = [
    {
      value: 'all',
      label: 'Semua Aktivitas',
    },
    {
      value: 'income',
      label: 'Pemasukan',
    },
    {
      value: 'expense',
      label: 'Pengeluaran',
    },
    {
      value: 'debt',
      label: 'Hutang',
    },
    {
      value: 'receivable',
      label: 'Piutang',
    },
    {
      value: 'population',
      label: 'Populasi',
    },
    {
      value: 'production',
      label: 'Produksi',
    },
    {
      value: 'death',
      label: 'Kematian',
    },
    {
      value: 'feed',
      label: 'Stok Pakan',
    },
    {
      value: 'inventory',
      label: 'Stok Barang',
    },
    {
      value: 'customer',
      label: 'Pelanggan',
    },
    {
      value: 'supplier',
      label: 'Supplier',
    },
  ]

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Riwayat Aktivitas
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pantau seluruh aktivitas yang tercatat di Smart Farm.
          </p>
        </div>

        <button
          onClick={loadActivities}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Total Aktivitas
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.total}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-xl">
              🕘
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Aktivitas Keuangan
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.financial}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl">
              💰
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Aktivitas Peternakan
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.farm}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl">
              🐔
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Aktivitas Stok
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900">
                {stats.stock}
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-xl">
              📦
            </div>
          </div>
        </div>
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
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Cari aktivitas..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) =>
              setFilterType(e.target.value)
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-red-500 focus:bg-white focus:ring-2 focus:ring-red-100"
          >
            {categoryOptions.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* ACTIVITY LIST */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">
                Aktivitas Terbaru
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {filteredActivities.length} aktivitas ditemukan.
              </p>
            </div>

            {filterType !== 'all' && (
              <button
                onClick={() =>
                  setFilterType('all')
                }
                className="text-xs font-semibold text-red-600 hover:text-red-700"
              >
                Reset filter
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="text-3xl">
              ⏳
            </div>

            <p className="mt-3 text-sm font-medium text-slate-500">
              Memuat riwayat aktivitas...
            </p>
          </div>
        ) : filteredActivities.length ===
          0 ? (
          <div className="p-10 text-center">
            <div className="text-4xl">
              🕘
            </div>

            <p className="mt-3 font-semibold text-slate-700">
              Belum ada aktivitas
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Tidak ada aktivitas yang sesuai dengan filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredActivities.map(
              (activity) => (
                <div
                  key={activity.id}
                  className="flex gap-4 p-5 transition hover:bg-slate-50"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                    {activity.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-bold text-slate-800">
                        {activity.title}
                      </h3>

                      <span className="text-xs text-slate-400">
                        {formatDateTime(
                          activity.timestamp
                        )}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {activity.description}
                    </p>

                    {activity.date && (
                      <p className="mt-2 text-xs font-medium text-slate-400">
                        📅 {formatDate(
                          activity.date
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* INFO */}
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
        <div className="flex gap-3">
          <div className="text-2xl">
            💡
          </div>

          <div>
            <h3 className="font-bold text-red-900">
              Riwayat Aktivitas Smart Farm.
            </h3>

            <p className="mt-1 text-sm leading-6 text-red-700">
              Halaman ini menggabungkan data pencatatan dari berbagai modul Smart Farm sehingga aktivitas keuangan dan peternakan dapat dipantau dari satu tempat.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActivityHistory