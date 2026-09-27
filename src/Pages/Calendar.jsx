import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Calendar({ user }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const [transactions, setTransactions] = useState([])
  const [production, setProduction] = useState([])
  const [deaths, setDeaths] = useState([])
  const [population, setPopulation] = useState([])
  const [feedStock, setFeedStock] = useState([])
  const [inventory, setInventory] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ]

  const dayNames = [
    'Min',
    'Sen',
    'Sel',
    'Rab',
    'Kam',
    'Jum',
    'Sab',
  ]

  useEffect(() => {
    loadCalendarData()
  }, [user])

  const loadCalendarData = async () => {
    try {
      setLoading(true)
      setError('')

      const [
        transactionResult,
        productionResult,
        deathResult,
        populationResult,
        feedResult,
        inventoryResult,
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id,
            type,
            title,
            amount,
            transaction_date
          `)
          .order('transaction_date', { ascending: true }),

        supabase
          .from('egg_production')
          .select(`
            id,
            record_date,
            total_eggs,
            good_eggs,
            broken_eggs,
            rejected_eggs
          `)
          .order('record_date', { ascending: true }),

        supabase
          .from('chicken_deaths')
          .select(`
            id,
            record_date,
            deaths,
            cause
          `)
          .order('record_date', { ascending: true }),

        supabase
          .from('chicken_population')
          .select(`
            id,
            record_date,
            initial_population,
            incoming,
            outgoing,
            deaths
          `)
          .order('record_date', { ascending: true }),

        supabase
          .from('feed_stock')
          .select(`
            id,
            record_date,
            feed_name,
            quantity,
            unit,
            minimum_stock
          `)
          .order('record_date', { ascending: true }),

        supabase
          .from('inventory')
          .select(`
            id,
            record_date,
            item_name,
            quantity,
            unit,
            minimum_stock
          `)
          .order('record_date', { ascending: true }),
      ])

      if (transactionResult.error) {
        console.error('Transactions:', transactionResult.error)
      }

      if (productionResult.error) {
        console.error('Production:', productionResult.error)
      }

      if (deathResult.error) {
        console.error('Deaths:', deathResult.error)
      }

      if (populationResult.error) {
        console.error('Population:', populationResult.error)
      }

      if (feedResult.error) {
        console.error('Feed stock:', feedResult.error)
      }

      if (inventoryResult.error) {
        console.error('Inventory:', inventoryResult.error)
      }

      setTransactions(transactionResult.data || [])
      setProduction(productionResult.data || [])
      setDeaths(deathResult.data || [])
      setPopulation(populationResult.data || [])
      setFeedStock(feedResult.data || [])
      setInventory(inventoryResult.data || [])
    } catch (err) {
      console.error(err)
      setError('Gagal memuat data kalender.')
    } finally {
      setLoading(false)
    }
  }

  const formatDateKey = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')

    return `${y}-${m}-${d}`
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0))
  }

  const activityMap = useMemo(() => {
    const map = {}

    const addActivity = (date, activity) => {
      if (!date) return

      if (!map[date]) {
        map[date] = []
      }

      map[date].push(activity)
    }

    transactions.forEach((item) => {
      addActivity(item.transaction_date, {
        type: item.type === 'income' ? 'income' : 'expense',
        icon: item.type === 'income' ? '💰' : '💸',
        label:
          item.type === 'income'
            ? 'Pemasukan'
            : 'Pengeluaran',
        title: item.title,
        value: formatCurrency(item.amount),
      })
    })

    production.forEach((item) => {
      addActivity(item.record_date, {
        type: 'production',
        icon: '🥚',
        label: 'Produksi Telur',
        title: `${Number(item.total_eggs || 0).toLocaleString(
          'id-ID'
        )} telur`,
        value: `Baik: ${Number(
          item.good_eggs || 0
        ).toLocaleString('id-ID')}`,
      })
    })

    deaths.forEach((item) => {
      addActivity(item.record_date, {
        type: 'death',
        icon: '🐔',
        label: 'Kematian Ayam',
        title: `${Number(item.deaths || 0).toLocaleString(
          'id-ID'
        )} ayam`,
        value: item.cause || 'Penyebab tidak dicatat',
      })
    })

    population.forEach((item) => {
      addActivity(item.record_date, {
        type: 'population',
        icon: '🐣',
        label: 'Populasi',
        title: `Awal: ${Number(
          item.initial_population || 0
        ).toLocaleString('id-ID')}`,
        value: `Masuk ${Number(
          item.incoming || 0
        ).toLocaleString('id-ID')} • Keluar ${Number(
          item.outgoing || 0
        ).toLocaleString('id-ID')}`,
      })
    })

    feedStock.forEach((item) => {
      addActivity(item.record_date, {
        type: 'feed',
        icon: '🌾',
        label: 'Stok Pakan',
        title: item.feed_name,
        value: `${Number(item.quantity || 0).toLocaleString(
          'id-ID'
        )} ${item.unit || 'kg'}`,
      })
    })

    inventory.forEach((item) => {
      addActivity(item.record_date, {
        type: 'inventory',
        icon: '📦',
        label: 'Stok Barang',
        title: item.item_name,
        value: `${Number(item.quantity || 0).toLocaleString(
          'id-ID'
        )} ${item.unit || 'pcs'}`,
      })
    })

    return map
  }, [
    transactions,
    production,
    deaths,
    population,
    feedStock,
    inventory,
  ])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPreviousMonth = new Date(
      year,
      month,
      0
    ).getDate()

    const days = []

    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPreviousMonth - i
      const date = new Date(year, month - 1, day)

      days.push({
        date,
        currentMonth: false,
      })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)

      days.push({
        date,
        currentMonth: true,
      })
    }

    while (days.length < 42) {
      const day = days.length - (firstDay + daysInMonth) + 1
      const date = new Date(year, month + 1, day)

      days.push({
        date,
        currentMonth: false,
      })
    }

    return days
  }, [year, month])

  const selectedActivities = selectedDate
    ? activityMap[selectedDate] || []
    : []

  const goPreviousMonth = () => {
    setCurrentDate(
      new Date(year, month - 1, 1)
    )
    setSelectedDate(null)
  }

  const goNextMonth = () => {
    setCurrentDate(
      new Date(year, month + 1, 1)
    )
    setSelectedDate(null)
  }

  const goToday = () => {
    const today = new Date()

    setCurrentDate(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    )

    setSelectedDate(formatDateKey(today))
  }

  const isToday = (date) => {
    const today = new Date()

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  const activityColors = {
    income: 'bg-emerald-500',
    expense: 'bg-red-500',
    production: 'bg-amber-500',
    death: 'bg-slate-700',
    population: 'bg-blue-500',
    feed: 'bg-orange-500',
    inventory: 'bg-violet-500',
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Kalender
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Pantau seluruh aktivitas peternakan berdasarkan tanggal.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadCalendarData}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            🔄 Refresh
          </button>

          <button
            onClick={goToday}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
          >
            📍 Hari Ini
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* LEGEND */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            Pemasukan
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            Pengeluaran
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            Produksi Telur
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-slate-700" />
            Kematian
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500" />
            Populasi
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-orange-500" />
            Stok Pakan
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-violet-500" />
            Stok Barang
          </div>
        </div>
      </div>

      {/* CALENDAR */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* CALENDAR HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
          <button
            onClick={goPreviousMonth}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-600 transition hover:bg-slate-50"
          >
            ←
          </button>

          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
              {monthNames[month]} {year}
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Kalender aktivitas Smart Farm
            </p>
          </div>

          <button
            onClick={goNextMonth}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-600 transition hover:bg-slate-50"
          >
            →
          </button>
        </div>

        {/* DAY NAMES */}
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {dayNames.map((day) => (
            <div
              key={day}
              className="px-1 py-3 text-center text-xs font-bold text-slate-500 sm:text-sm"
            >
              {day}
            </div>
          ))}
        </div>

        {/* DAYS */}
        <div className="grid grid-cols-7">
          {calendarDays.map(
            ({ date, currentMonth }, index) => {
              const dateKey = formatDateKey(date)
              const activities =
                activityMap[dateKey] || []

              const selected =
                selectedDate === dateKey

              return (
                <button
                  key={`${dateKey}-${index}`}
                  onClick={() =>
                    setSelectedDate(dateKey)
                  }
                  className={`relative min-h-[90px] border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[120px] sm:p-2 ${
                    currentMonth
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-slate-50/70'
                  } ${
                    selected
                      ? 'ring-2 ring-inset ring-red-500'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 sm:text-sm ${
                        isToday(date)
                          ? 'bg-red-600 text-white'
                          : currentMonth
                          ? 'text-slate-700'
                          : 'text-slate-300'
                      }`}
                    >
                      {date.getDate()}
                    </span>

                    {activities.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                        {activities.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {activities
                      .slice(0, 3)
                      .map((activity, activityIndex) => (
                        <div
                          key={`${activity.type}-${activityIndex}`}
                          className="flex items-center gap-1.5 overflow-hidden"
                        >
                          <span
                            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                              activityColors[
                                activity.type
                              ] || 'bg-slate-400'
                            }`}
                          />

                          <span className="truncate text-[9px] font-medium text-slate-500 sm:text-[10px]">
                            {activity.label}
                          </span>
                        </div>
                      ))}

                    {activities.length > 3 && (
                      <div className="text-[9px] font-semibold text-red-600">
                        +{activities.length - 3} lainnya
                      </div>
                    )}
                  </div>
                </button>
              )
            }
          )}
        </div>
      </div>

      {/* SELECTED DATE */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">
            {selectedDate
              ? `Aktivitas ${new Date(
                  `${selectedDate}T00:00:00`
                ).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}`
              : 'Pilih Tanggal'}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Detail aktivitas peternakan pada tanggal yang dipilih.
          </p>
        </div>

        <div className="p-5">
          {!selectedDate ? (
            <div className="py-8 text-center">
              <div className="text-4xl">📅</div>

              <p className="mt-3 text-sm font-medium text-slate-600">
                Klik salah satu tanggal pada kalender.
              </p>
            </div>
          ) : selectedActivities.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-4xl">✨</div>

              <p className="mt-3 text-sm font-semibold text-slate-700">
                Tidak ada aktivitas
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Belum ada pencatatan pada tanggal ini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedActivities.map(
                (activity, index) => (
                  <div
                    key={`${activity.type}-${index}`}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                      {activity.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          {activity.label}
                        </span>
                      </div>

                      <p className="mt-1 font-semibold text-slate-800">
                        {activity.title}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {activity.value}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          Memuat kalender...
        </div>
      )}
    </div>
  )
}

export default Calendar