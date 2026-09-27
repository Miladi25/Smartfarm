import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Notifications({ user }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // =========================
  // FORMAT CURRENCY
  // =========================
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0))
  }

  // =========================
  // FORMAT DATE
  // =========================
  const formatDate = (value) => {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return '-'
    }

    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  // =========================
  // HITUNG SELISIH HARI
  // =========================
  const daysDifference = (dateValue) => {
    if (!dateValue) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const target = new Date(dateValue)
    target.setHours(0, 0, 0, 0)

    return Math.ceil(
      (target - today) /
        (1000 * 60 * 60 * 24)
    )
  }

  // =========================
  // LOAD NOTIFICATIONS
  // =========================
  const loadNotifications = async () => {
    try {
      if (!refreshing) {
        setLoading(true)
      }

      const [
        feedResult,
        inventoryResult,
        debtResult,
        receivableResult,
        deathResult,
        productionResult,
      ] = await Promise.all([
        supabase
          .from('feed_stock')
          .select('*')
          .order('record_date', {
            ascending: false,
          }),

        supabase
          .from('inventory')
          .select('*')
          .order('record_date', {
            ascending: false,
          }),

        supabase
          .from('debts')
          .select('*')
          .order('due_date', {
            ascending: true,
          }),

        supabase
          .from('receivables')
          .select('*')
          .order('due_date', {
            ascending: true,
          }),

        supabase
          .from('chicken_deaths')
          .select('*')
          .order('record_date', {
            ascending: false,
          }),

        supabase
          .from('egg_production')
          .select('*')
          .order('record_date', {
            ascending: false,
          }),
      ])

      if (feedResult.error) {
        console.error(
          'Gagal mengambil stok pakan:',
          feedResult.error
        )
      }

      if (inventoryResult.error) {
        console.error(
          'Gagal mengambil stok barang:',
          inventoryResult.error
        )
      }

      if (debtResult.error) {
        console.error(
          'Gagal mengambil hutang:',
          debtResult.error
        )
      }

      if (receivableResult.error) {
        console.error(
          'Gagal mengambil piutang:',
          receivableResult.error
        )
      }

      if (deathResult.error) {
        console.error(
          'Gagal mengambil kematian ayam:',
          deathResult.error
        )
      }

      if (productionResult.error) {
        console.error(
          'Gagal mengambil produksi telur:',
          productionResult.error
        )
      }

      const feedStock =
        feedResult.data || []

      const inventory =
        inventoryResult.data || []

      const debts =
        debtResult.data || []

      const receivables =
        receivableResult.data || []

      const deaths =
        deathResult.data || []

      const productions =
        productionResult.data || []

      const generated = []

      // =========================
      // STOK PAKAN
      // =========================
      feedStock.forEach((item) => {
        const quantity = Number(
          item.quantity || 0
        )

        const minimum = Number(
          item.minimum_stock || 0
        )

        if (quantity <= minimum) {
          generated.push({
            id: `feed-${item.id}`,
            type: 'stock',
            priority: 'high',
            icon: '🌾',
            title: 'Stok pakan menipis',
            message: `${item.feed_name} tersisa ${quantity} ${item.unit || 'kg'}. Batas minimum ${minimum} ${item.unit || 'kg'}.`,
            date: item.record_date,
          })
        }
      })

      // =========================
      // STOK BARANG
      // =========================
      inventory.forEach((item) => {
        const quantity = Number(
          item.quantity || 0
        )

        const minimum = Number(
          item.minimum_stock || 0
        )

        if (quantity <= minimum) {
          generated.push({
            id: `inventory-${item.id}`,
            type: 'inventory',
            priority: 'high',
            icon: '📦',
            title: 'Stok barang menipis',
            message: `${item.item_name} tersisa ${quantity} ${item.unit || 'pcs'}. Batas minimum ${minimum} ${item.unit || 'pcs'}.`,
            date: item.record_date,
          })
        }
      })

      // =========================
      // HUTANG
      // =========================
      debts
        .filter(
          (item) =>
            item.status !== 'paid'
        )
        .forEach((item) => {
          if (!item.due_date) return

          const days = daysDifference(
            item.due_date
          )

          if (days < 0) {
            generated.push({
              id: `debt-overdue-${item.id}`,
              type: 'debt',
              priority: 'high',
              icon: '💳',
              title:
                'Hutang telah jatuh tempo',
              message: `${item.title} sebesar ${formatCurrency(item.amount)} telah melewati tanggal jatuh tempo.`,
              date: item.due_date,
            })
          } else if (days === 0) {
            generated.push({
              id: `debt-today-${item.id}`,
              type: 'debt',
              priority: 'high',
              icon: '💳',
              title:
                'Hutang jatuh tempo hari ini',
              message: `${item.title} sebesar ${formatCurrency(item.amount)} harus dibayar hari ini.`,
              date: item.due_date,
            })
          } else if (days <= 3) {
            generated.push({
              id: `debt-soon-${item.id}`,
              type: 'debt',
              priority: 'medium',
              icon: '⏰',
              title:
                'Hutang segera jatuh tempo',
              message: `${item.title} sebesar ${formatCurrency(item.amount)} jatuh tempo dalam ${days} hari.`,
              date: item.due_date,
            })
          }
        })

      // =========================
      // PIUTANG
      // =========================
      receivables
        .filter(
          (item) =>
            item.status !== 'paid'
        )
        .forEach((item) => {
          if (!item.due_date) return

          const days = daysDifference(
            item.due_date
          )

          if (days < 0) {
            generated.push({
              id: `receivable-overdue-${item.id}`,
              type: 'receivable',
              priority: 'high',
              icon: '💰',
              title:
                'Piutang telah jatuh tempo',
              message: `${item.title} sebesar ${formatCurrency(item.amount)} telah melewati tanggal jatuh tempo.`,
              date: item.due_date,
            })
          } else if (days === 0) {
            generated.push({
              id: `receivable-today-${item.id}`,
              type: 'receivable',
              priority: 'medium',
              icon: '💰',
              title:
                'Piutang jatuh tempo hari ini',
              message: `${item.title} sebesar ${formatCurrency(item.amount)} jatuh tempo hari ini.`,
              date: item.due_date,
            })
          } else if (days <= 3) {
            generated.push({
              id: `receivable-soon-${item.id}`,
              type: 'receivable',
              priority: 'low',
              icon: '💰',
              title:
                'Piutang segera jatuh tempo',
              message: `${item.title} sebesar ${formatCurrency(item.amount)} jatuh tempo dalam ${days} hari.`,
              date: item.due_date,
            })
          }
        })

      // =========================
      // KEMATIAN AYAM
      // =========================
      deaths.forEach((item) => {
        const totalDeaths = Number(
          item.deaths || 0
        )

        if (totalDeaths >= 10) {
          generated.push({
            id: `death-high-${item.id}`,
            type: 'death',
            priority: 'high',
            icon: '🐔',
            title: 'Kematian ayam tinggi',
            message: `Tercatat ${totalDeaths} ayam mati pada ${formatDate(item.record_date)}.${item.cause ? ` Penyebab: ${item.cause}.` : ''}`,
            date: item.record_date,
          })
        } else if (totalDeaths >= 5) {
          generated.push({
            id: `death-medium-${item.id}`,
            type: 'death',
            priority: 'medium',
            icon: '⚠️',
            title:
              'Perlu perhatian pada kematian ayam',
            message: `Tercatat ${totalDeaths} ayam mati pada ${formatDate(item.record_date)}.`,
            date: item.record_date,
          })
        }
      })

      // =========================
      // PRODUKSI TELUR
      // =========================
      productions.forEach((item) => {
        const total = Number(
          item.total_eggs || 0
        )

        const good = Number(
          item.good_eggs || 0
        )

        if (total <= 0) return

        const quality =
          (good / total) * 100

        if (quality < 80) {
          generated.push({
            id: `production-${item.id}`,
            type: 'production',
            priority: 'medium',
            icon: '🥚',
            title:
              'Kualitas produksi telur menurun',
            message: `Kualitas telur pada ${formatDate(item.record_date)} hanya ${quality.toFixed(1)}%.`,
            date: item.record_date,
          })
        }
      })

      // =========================
      // SORT PRIORITAS
      // =========================
      const priorityOrder = {
        high: 1,
        medium: 2,
        low: 3,
      }

      generated.sort((a, b) => {
        const priorityDifference =
          priorityOrder[a.priority] -
          priorityOrder[b.priority]

        if (
          priorityDifference !== 0
        ) {
          return priorityDifference
        }

        return (
          new Date(b.date || 0) -
          new Date(a.date || 0)
        )
      })

      setNotifications(generated)
    } catch (error) {
      console.error(
        'Gagal memuat notifikasi:',
        error
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // =========================
  // INITIAL LOAD
  // =========================
  useEffect(() => {
    loadNotifications()
  }, [])

  // =========================
  // REFRESH
  // =========================
  const handleRefresh = async () => {
    setRefreshing(true)

    await loadNotifications()
  }

  // =========================
  // STATISTICS
  // =========================
  const stats = useMemo(() => {
    return {
      total: notifications.length,

      high: notifications.filter(
        (item) =>
          item.priority === 'high'
      ).length,

      medium: notifications.filter(
        (item) =>
          item.priority === 'medium'
      ).length,

      low: notifications.filter(
        (item) =>
          item.priority === 'low'
      ).length,
    }
  }, [notifications])

  // =========================
  // PRIORITY STYLE
  // =========================
  const getPriorityStyle = (
    priority
  ) => {
    if (priority === 'high') {
      return {
        badge:
          'bg-red-100 text-red-700',
        border:
          'border-red-200',
        iconBg:
          'bg-red-50',
        label:
          'Prioritas Tinggi',
      }
    }

    if (priority === 'medium') {
      return {
        badge:
          'bg-orange-100 text-orange-700',
        border:
          'border-orange-200',
        iconBg:
          'bg-orange-50',
        label:
          'Perlu Perhatian',
      }
    }

    return {
      badge:
        'bg-blue-100 text-blue-700',
      border:
        'border-blue-200',
      iconBg:
        'bg-blue-50',
      label:
        'Informasi',
    }
  }

  // =========================
  // TYPE LABEL
  // =========================
  const getTypeLabel = (type) => {
    const labels = {
      stock: 'Stok Pakan',
      inventory: 'Stok Barang',
      debt: 'Hutang',
      receivable: 'Piutang',
      death: 'Kematian',
      production: 'Produksi',
    }

    return labels[type] || 'Sistem'
  }

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

            <p className="text-sm text-slate-500">
              Memuat notifikasi...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* HEADER */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-2xl">
              🔔
            </span>

            <h1 className="text-2xl font-bold text-slate-900">
              Notifikasi
            </h1>
          </div>

          <p className="text-sm text-slate-500">
            Pantau hal-hal penting yang
            membutuhkan perhatian.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className={
              refreshing
                ? 'animate-spin'
                : ''
            }
          >
            ↻
          </span>

          {refreshing
            ? 'Memuat...'
            : 'Refresh'}
        </button>
      </div>

      {/* STATS */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Total Notifikasi
            </span>

            <span className="text-xl">
              🔔
            </span>
          </div>

          <p className="text-3xl font-bold text-slate-900">
            {stats.total}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Notifikasi aktif
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Prioritas Tinggi
            </span>

            <span className="text-xl">
              🔴
            </span>
          </div>

          <p className="text-3xl font-bold text-red-600">
            {stats.high}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Perlu segera ditangani
          </p>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Perlu Perhatian
            </span>

            <span className="text-xl">
              🟠
            </span>
          </div>

          <p className="text-3xl font-bold text-orange-600">
            {stats.medium}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Perlu dipantau
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">
              Informasi
            </span>

            <span className="text-xl">
              🔵
            </span>
          </div>

          <p className="text-3xl font-bold text-blue-600">
            {stats.low}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Informasi tambahan
          </p>
        </div>
      </div>

      {/* NOTIFICATION LIST */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-900">
            Notifikasi Aktif
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Sistem akan membuat notifikasi
            berdasarkan kondisi data Smart Farm.
          </p>
        </div>

        {notifications.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mb-4 text-5xl">
              🎉
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              Tidak ada notifikasi
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Semua kondisi terlihat aman
              untuk saat ini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map(
              (notification) => {
                const style =
                  getPriorityStyle(
                    notification.priority
                  )

                return (
                  <div
                    key={notification.id}
                    className={`p-5 transition hover:bg-slate-50 ${style.border}`}
                  >
                    <div className="flex gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${style.iconBg}`}
                      >
                        {
                          notification.icon
                        }
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">
                              {
                                notification.title
                              }
                            </h3>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}
                            >
                              {
                                style.label
                              }
                            </span>

                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              {getTypeLabel(
                                notification.type
                              )}
                            </span>
                          </div>

                          <span className="text-xs text-slate-400">
                            {formatDate(
                              notification.date
                            )}
                          </span>
                        </div>

                        <p className="text-sm leading-6 text-slate-600">
                          {
                            notification.message
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )
              }
            )}
          </div>
        )}
      </div>

      {/* INFO */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex gap-3">
          <div className="text-xl">
            💡
          </div>

          <div>
            <h3 className="font-bold text-slate-900">
              Cara kerja notifikasi
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Notifikasi diperiksa langsung
              dari data stok, hutang, piutang,
              kematian ayam, dan produksi telur.
              Tekan tombol Refresh untuk
              mendapatkan kondisi terbaru.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Notifications