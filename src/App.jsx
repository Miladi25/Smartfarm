import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

import Login from './pages/Login'
import Finance from './pages/Finance'
import DebtReceivable from './pages/DebtReceivable'
import Population from './pages/Population'
import ChickenTypes from './pages/ChickenTypes'
import Production from './pages/Production'
import Deaths from './pages/Deaths'
import FeedStock from './pages/FeedStock'
import Inventory from './pages/Inventory'
import FinancialAnalysis from './pages/FinancialAnalysis'
import ProductionAnalysis from './pages/ProductionAnalysis'
import ProfitAnalysis from './pages/ProfitAnalysis'
import Customers from './pages/Customers'
import Supplier from './pages/Supplier'
import Calendar from './pages/Calendar'
import ActivityHistory from './pages/ActivityHistory'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import SuperAdmin from './pages/SuperAdmin'

function App() {
  const [user, setUser] = useState(null)
  const [activePage, setActivePage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return (
        localStorage.getItem(
          'smartfarm_sidebar_collapsed'
        ) === 'true'
      )
    } catch {
      return false
    }
  })

  const [dashboardData, setDashboardData] = useState({
    income: 0,
    expense: 0,
    profit: 0,
    population: 0,
    debt: 0,
    receivable: 0,
    eggProduction: 0,
    deaths: 0,
  })

  const [loadingDashboard, setLoadingDashboard] = useState(false)

  // =====================================================
  // SIDEBAR PREFERENCE
  // =====================================================

  useEffect(() => {
    try {
      localStorage.setItem(
        'smartfarm_sidebar_collapsed',
        String(sidebarCollapsed)
      )
    } catch {
      // ignore
    }
  }, [sidebarCollapsed])

  // =====================================================
  // LOAD SESSION
  // =====================================================

  useEffect(() => {
    const savedUser = localStorage.getItem('farmfin_user')

    if (!savedUser) return

    try {
      const parsedUser = JSON.parse(savedUser)

      if (parsedUser?.id) {
        setUser(parsedUser)
      }
    } catch (error) {
      console.error('Session tidak valid:', error)

      localStorage.removeItem('farmfin_user')
    }
  }, [])

  // =====================================================
  // LOGIN
  // =====================================================

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
    setActivePage('dashboard')
    setSidebarOpen(false)
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    localStorage.removeItem('farmfin_user')

    setUser(null)
    setActivePage('dashboard')
    setSidebarOpen(false)

    setDashboardData({
      income: 0,
      expense: 0,
      profit: 0,
      population: 0,
      debt: 0,
      receivable: 0,
      eggProduction: 0,
      deaths: 0,
    })
  }

  // =====================================================
  // FARM CONTEXT
  // =====================================================

  const farmContext = useMemo(() => {
    if (!user) return null

    return {
      farmId: user.farm_id || null,

      farmCode:
        user.farm_code ||
        user.farm?.farm_code ||
        null,

      farmName:
        user.farm_name ||
        user.farm?.name ||
        null,

      packageName:
        user.package_name ||
        user.farm?.package_name ||
        null,

      isSuperAdmin:
        user.is_super_admin === true,
    }
  }, [user])

  // =====================================================
  // ROLE
  // =====================================================

  const isSuperAdmin = user?.is_super_admin === true

  const isAdmin =
    user?.role === 'admin' &&
    !isSuperAdmin

  const isRegularUser =
    user?.role === 'user' &&
    !isSuperAdmin

  // =====================================================
  // RESET FARM DASHBOARD
  // =====================================================

  const resetDashboardData = () => {
    setDashboardData({
      income: 0,
      expense: 0,
      profit: 0,
      population: 0,
      debt: 0,
      receivable: 0,
      eggProduction: 0,
      deaths: 0,
    })
  }

  // =====================================================
  // LOAD FARM DASHBOARD
  //
  // HANYA UNTUK ADMIN / USER PETERNakan
  //
  // SUPER ADMIN TIDAK MENGGUNAKAN DATA INI.
  // SUPER ADMIN menggunakan SuperAdmin.jsx.
  // =====================================================

  const loadDashboardData = async () => {
    if (!user || isSuperAdmin) {
      return
    }

    const farmId = user.farm_id

    if (!farmId) {
      resetDashboardData()
      return
    }

    setLoadingDashboard(true)

    try {
      const [
        transactionsResult,
        populationResult,
        debtResult,
        receivableResult,
        productionResult,
        deathsResult,
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('farm_id', farmId),

        supabase
          .from('chicken_population')
          .select('*')
          .eq('farm_id', farmId),

        supabase
          .from('debts')
          .select('*')
          .eq('farm_id', farmId),

        supabase
          .from('receivables')
          .select('*')
          .eq('farm_id', farmId),

        supabase
          .from('egg_production')
          .select('*')
          .eq('farm_id', farmId),

        supabase
          .from('chicken_deaths')
          .select('*')
          .eq('farm_id', farmId),
      ])

      // ===================================================
      // TRANSACTIONS
      // ===================================================

      let income = 0
      let expense = 0

      if (!transactionsResult.error) {
        ;(transactionsResult.data || []).forEach(
          (transaction) => {
            const amount =
              Number(transaction.amount) || 0

            const type = String(
              transaction.type || ''
            ).toLowerCase()

            if (
              type === 'income' ||
              type === 'pemasukan'
            ) {
              income += amount
            }

            if (
              type === 'expense' ||
              type === 'pengeluaran'
            ) {
              expense += amount
            }
          }
        )
      }

      // ===================================================
      // POPULATION
      // ===================================================

      let population = 0

      if (!populationResult.error) {
        ;(populationResult.data || []).forEach(
          (row) => {
            let value = 0

            if (
              row.current_population !== undefined &&
              row.current_population !== null
            ) {
              value =
                Number(
                  row.current_population
                ) || 0
            } else if (
              row.quantity !== undefined &&
              row.quantity !== null
            ) {
              value =
                Number(row.quantity) || 0
            } else {
              const initial =
                Number(
                  row.initial_population
                ) || 0

              const incoming =
                Number(row.incoming) || 0

              const outgoing =
                Number(row.outgoing) || 0

              const deaths =
                Number(row.deaths) || 0

              value =
                initial +
                incoming -
                outgoing -
                deaths
            }

            population += value
          }
        )
      }

      // ===================================================
      // DEBT
      // ===================================================

      let debt = 0

      if (!debtResult.error) {
        ;(debtResult.data || []).forEach(
          (row) => {
            const status = String(
              row.status || ''
            ).toLowerCase()

            if (
              status === 'paid' ||
              status === 'lunas'
            ) {
              return
            }

            debt +=
              Number(
                row.remaining_amount ??
                  row.amount ??
                  0
              ) || 0
          }
        )
      }

      // ===================================================
      // RECEIVABLE
      // ===================================================

      let receivable = 0

      if (!receivableResult.error) {
        ;(receivableResult.data || []).forEach(
          (row) => {
            const status = String(
              row.status || ''
            ).toLowerCase()

            if (
              status === 'paid' ||
              status === 'lunas'
            ) {
              return
            }

            receivable +=
              Number(
                row.remaining_amount ??
                  row.amount ??
                  0
              ) || 0
          }
        )
      }

      // ===================================================
      // EGG PRODUCTION
      // ===================================================

      let eggProduction = 0

      if (!productionResult.error) {
        ;(productionResult.data || []).forEach(
          (row) => {
            eggProduction +=
              Number(
                row.total_eggs ??
                  row.quantity ??
                  0
              ) || 0
          }
        )
      }

      // ===================================================
      // DEATHS
      // ===================================================

      let deaths = 0

      if (!deathsResult.error) {
        ;(deathsResult.data || []).forEach(
          (row) => {
            deaths +=
              Number(
                row.death_count ??
                  row.deaths ??
                  row.quantity ??
                  0
              ) || 0
          }
        )
      }

      setDashboardData({
        income,
        expense,
        profit: income - expense,
        population,
        debt,
        receivable,
        eggProduction,
        deaths,
      })
    } catch (error) {
      console.error(
        'Gagal mengambil dashboard:',
        error
      )
    } finally {
      setLoadingDashboard(false)
    }
  }

  // =====================================================
  // DASHBOARD EFFECT
  //
  // PENTING:
  // SUPER ADMIN TIDAK BOLEH MEMANGGIL
  // DASHBOARD FARM BIASA.
  // =====================================================

  useEffect(() => {
    if (!user) return

    if (
      activePage === 'dashboard' &&
      !isSuperAdmin
    ) {
      loadDashboardData()
    }
  }, [
    user,
    activePage,
    isSuperAdmin,
  ])

  // =====================================================
  // NAVIGATION
  // =====================================================

  const navigate = (page) => {
    setActivePage(page)
    setSidebarOpen(false)
  }

  // =====================================================
  // FARM MENU
  // =====================================================

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
    },
    {
      id: 'finance',
      label: 'Keuangan',
      icon: '💰',
    },
    {
      id: 'debt',
      label: 'Hutang & Piutang',
      icon: '💳',
    },
    {
      id: 'chicken-types',
      label: 'Jenis Ayam',
      icon: '🐔',
    },
    {
      id: 'population',
      label: 'Populasi Ayam',
      icon: '🐔',
    },
    {
      id: 'production',
      label: 'Produksi Telur',
      icon: '🥚',
    },
    {
      id: 'deaths',
      label: 'Kematian Ayam',
      icon: '📉',
    },
    {
      id: 'feed',
      label: 'Stok Pakan',
      icon: '🌾',
    },
    {
      id: 'inventory',
      label: 'Stok Barang',
      icon: '📦',
    },
    {
      id: 'financial-analysis',
      label: 'Analisis Keuangan',
      icon: '📈',
    },
    {
      id: 'production-analysis',
      label: 'Analisis Produksi',
      icon: '📊',
    },
    {
      id: 'profit-analysis',
      label: 'Analisis Keuntungan',
      icon: '💹',
    },
    {
      id: 'customers',
      label: 'Pelanggan',
      icon: '👥',
    },
    {
      id: 'supplier',
      label: 'Supplier',
      icon: '🚚',
    },
    {
      id: 'calendar',
      label: 'Kalender',
      icon: '📅',
    },
    {
      id: 'activity',
      label: 'Riwayat Aktivitas',
      icon: '🕘',
    },
    {
      id: 'notifications',
      label: 'Notifikasi',
      icon: '🔔',
    },
  ]

  // =====================================================
  // ADMIN MENU
  // =====================================================

  const adminItems = [
    {
      id: 'settings',
      label: 'Pengaturan',
      icon: '⚙️',
    },
  ]

  // =====================================================
  // SUPER ADMIN MENU
  // =====================================================

  const superAdminItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
    },
    {
      id: 'add-farm',
      label: 'Tambah Peternakan',
      icon: '➕',
    },
    {
      id: 'manage-farms',
      label: 'Kelola Peternakan',
      icon: '🏢',
    },
  ]

  // =====================================================
  // FORMAT CURRENCY
  // =====================================================

  const formatCurrency = (value) => {
    return new Intl.NumberFormat(
      'id-ID',
      {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }
    ).format(value || 0)
  }

  // =====================================================
  // PAGE TITLE
  // =====================================================

  const pageTitle = useMemo(() => {
    if (activePage === 'dashboard') {
      return isSuperAdmin
        ? 'Dashboard Performa'
        : 'Dashboard'
    }

    const allMenus = [
      ...menuItems,
      ...adminItems,
      ...superAdminItems,
    ]

    return (
      allMenus.find(
        (item) =>
          item.id === activePage
      )?.label ||
      'smartFarm'
    )
  }, [
    activePage,
    isSuperAdmin,
  ])

  // =====================================================
  // LOGIN SCREEN
  // =====================================================

  if (!user) {
    return (
      <Login
        onLogin={handleLogin}
      />
    )
  }

  // =====================================================
  // PAGE ACCESS
  // =====================================================

  const canAccessPage = (page) => {
    // -----------------------------------------------
    // SUPER ADMIN
    // -----------------------------------------------

    if (isSuperAdmin) {
      return [
        'dashboard',
        'add-farm',
        'manage-farms',
      ].includes(page)
    }

    // -----------------------------------------------
    // ADMIN PETERNakan
    // -----------------------------------------------

    if (page === 'settings') {
      return isAdmin
    }

    // -----------------------------------------------
    // USER / ADMIN FARM
    // -----------------------------------------------

    return true
  }

  // =====================================================
  // PAGE RENDERER
  // =====================================================

  const renderPage = () => {
    if (!canAccessPage(activePage)) {
      return (
        <AccessDenied
          onBack={() =>
            navigate('dashboard')
          }
        />
      )
    }

    // ===================================================
    // SUPER ADMIN DASHBOARD
    //
    // DATA DIAMBIL OLEH SuperAdmin.jsx
    // DAN MENGAGREGASI SEMUA PETERNakan.
    // ===================================================

    if (
      isSuperAdmin &&
      activePage === 'dashboard'
    ) {
      return (
        <SuperAdmin
          user={user}
          farm={farmContext}
          mode="dashboard"
        />
      )
    }

    // ===================================================
    // SUPER ADMIN ADD FARM
    // ===================================================

    if (
      isSuperAdmin &&
      activePage === 'add-farm'
    ) {
      return (
        <SuperAdmin
          user={user}
          farm={farmContext}
          mode="add-farm"
        />
      )
    }

    // ===================================================
    // SUPER ADMIN MANAGE FARMS
    // ===================================================

    if (
      isSuperAdmin &&
      activePage === 'manage-farms'
    ) {
      return (
        <SuperAdmin
          user={user}
          farm={farmContext}
          mode="manage-farms"
        />
      )
    }

    // ===================================================
    // FARM DASHBOARD
    // ===================================================

    if (activePage === 'dashboard') {
      return (
        <Dashboard
          user={user}
          farm={farmContext}
          data={dashboardData}
          loading={loadingDashboard}
          formatCurrency={
            formatCurrency
          }
          onRefresh={
            loadDashboardData
          }
        />
      )
    }

    // ===================================================
    // FARM MODULES
    // ===================================================

    switch (activePage) {
      case 'finance':
        return (
          <Finance
            user={user}
            farm={farmContext}
          />
        )

      case 'debt':
        return (
          <DebtReceivable
            user={user}
            farm={farmContext}
          />
        )

      case 'chicken-types':
        return (
          <ChickenTypes
            user={user}
            farm={farmContext}
          />
        )

      case 'population':
        return (
          <Population
            user={user}
            farm={farmContext}
          />
        )

      case 'production':
        return (
          <Production
            user={user}
            farm={farmContext}
          />
        )

      case 'deaths':
        return (
          <Deaths
            user={user}
            farm={farmContext}
          />
        )

      case 'feed':
        return (
          <FeedStock
            user={user}
            farm={farmContext}
          />
        )

      case 'inventory':
        return (
          <Inventory
            user={user}
            farm={farmContext}
          />
        )

      case 'financial-analysis':
        return (
          <FinancialAnalysis
            user={user}
            farm={farmContext}
          />
        )

      case 'production-analysis':
        return (
          <ProductionAnalysis
            user={user}
            farm={farmContext}
          />
        )

      case 'profit-analysis':
        return (
          <ProfitAnalysis
            user={user}
            farm={farmContext}
          />
        )

      case 'customers':
        return (
          <Customers
            user={user}
            farm={farmContext}
          />
        )

      case 'supplier':
        return (
          <Supplier
            user={user}
            farm={farmContext}
          />
        )

      case 'calendar':
        return (
          <Calendar
            user={user}
            farm={farmContext}
          />
        )

      case 'activity':
        return (
          <ActivityHistory
            user={user}
            farm={farmContext}
          />
        )

      case 'notifications':
        return (
          <Notifications
            user={user}
            farm={farmContext}
          />
        )

      case 'settings':
        return (
          <Settings
            user={user}
            farm={farmContext}
          />
        )

      default:
        return (
          <Dashboard
            user={user}
            farm={farmContext}
            data={dashboardData}
            loading={loadingDashboard}
            formatCurrency={
              formatCurrency
            }
            onRefresh={
              loadDashboardData
            }
          />
        )
    }
  }

  // =====================================================
  // APP UI
  // =====================================================

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-100">

      {/* MOBILE OVERLAY */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() =>
            setSidebarOpen(false)
          }
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40
          flex flex-col
          border-r border-white/10
          bg-slate-950 text-white
          shadow-2xl
          transition-all duration-300 ease-in-out
          lg:sticky lg:top-0 lg:h-screen
          ${
            sidebarCollapsed
              ? 'lg:w-[82px]'
              : 'lg:w-[272px]'
          }
          ${
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full lg:translate-x-0'
          }
          w-[272px]
        `}
      >

        {/* BRAND */}

        <div
          className={`
            flex h-20 shrink-0 items-center border-b border-white/10
            ${
              sidebarCollapsed
                ? 'justify-center px-3'
                : 'px-4'
            }
          `}
        >
          <div
            className={`
              flex min-w-0 items-center
              ${
                sidebarCollapsed
                  ? 'justify-center'
                  : 'gap-3'
              }
            `}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-xl shadow-lg shadow-red-600/20">
              🐔
            </div>

            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="truncate text-lg font-black">
                  smart
                  <span className="text-red-500">
                    Farm
                  </span>
                </h1>

                <p className="truncate text-[10px] text-slate-500">
                  Peternakan Digital
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setSidebarCollapsed(
                (value) => !value
              )
            }
            className={`
              hidden rounded-xl border border-white/10
              p-2 text-slate-400
              transition hover:bg-white/10 hover:text-white
              lg:block
              ${
                sidebarCollapsed
                  ? 'absolute -right-3 top-6 bg-slate-900 shadow-lg'
                  : 'ml-auto'
              }
            `}
            title={
              sidebarCollapsed
                ? 'Buka sidebar'
                : 'Kecilkan sidebar'
            }
          >
            {sidebarCollapsed
              ? '→'
              : '←'}
          </button>

          <button
            type="button"
            onClick={() =>
              setSidebarOpen(false)
            }
            className="ml-auto rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* FARM INFO */}

        <div
          className={`
            shrink-0 border-b border-white/10
            ${
              sidebarCollapsed
                ? 'p-3'
                : 'p-4'
            }
          `}
        >
          {sidebarCollapsed ? (
            <div
              className="flex justify-center"
              title={
                isSuperAdmin
                  ? 'Semua Peternakan'
                  : farmContext?.farmName ||
                    'Farm belum terhubung'
              }
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-sm">
                {isSuperAdmin
                  ? '👑'
                  : '🏠'}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {isSuperAdmin
                    ? 'Akses Sistem'
                    : 'Peternakan Aktif'}
                </span>

                {isSuperAdmin && (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[8px] font-bold text-red-400">
                    SUPER ADMIN
                  </span>
                )}
              </div>

              <p className="truncate text-sm font-bold text-white">
                {isSuperAdmin
                  ? 'Semua Peternakan'
                  : farmContext?.farmName ||
                    'Farm belum terhubung'}
              </p>

              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-slate-500">
                  {isSuperAdmin
                    ? 'Control Center'
                    : farmContext?.farmCode ||
                      '-'}
                </span>

                {!isSuperAdmin &&
                  farmContext?.packageName && (
                    <span className="shrink-0 text-[9px] text-slate-500">
                      {farmContext.packageName}
                    </span>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* MENU */}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">

          {/* FARM MENU */}

          {!isSuperAdmin && (
            <>
              {!sidebarCollapsed && (
                <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Menu Utama
                </p>
              )}

              <nav className="space-y-1">
                {menuItems.map(
                  (item) => (
                    <SidebarItem
                      key={item.id}
                      item={item}
                      active={
                        activePage ===
                        item.id
                      }
                      collapsed={
                        sidebarCollapsed
                      }
                      onClick={() =>
                        navigate(
                          item.id
                        )
                      }
                    />
                  )
                )}
              </nav>
            </>
          )}

          {/* ADMIN */}

          {isAdmin && (
            <>
              {!sidebarCollapsed && (
                <p className="mb-2 mt-6 px-3 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Administrasi
                </p>
              )}

              <nav className="mt-4 space-y-1 lg:mt-0">
                {adminItems.map(
                  (item) => (
                    <SidebarItem
                      key={item.id}
                      item={item}
                      active={
                        activePage ===
                        item.id
                      }
                      collapsed={
                        sidebarCollapsed
                      }
                      onClick={() =>
                        navigate(
                          item.id
                        )
                      }
                    />
                  )
                )}
              </nav>
            </>
          )}

          {/* SUPER ADMIN */}

          {isSuperAdmin && (
            <>
              {!sidebarCollapsed && (
                <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Manajemen Sistem
                </p>
              )}

              <nav className="space-y-1">
                {superAdminItems.map(
                  (item) => (
                    <SidebarItem
                      key={item.id}
                      item={item}
                      active={
                        activePage ===
                        item.id
                      }
                      collapsed={
                        sidebarCollapsed
                      }
                      onClick={() =>
                        navigate(
                          item.id
                        )
                      }
                      special
                    />
                  )
                )}
              </nav>

              {!sidebarCollapsed && (
                <div className="mt-5 rounded-2xl border border-red-500/10 bg-red-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-sm">
                      🛡️
                    </span>

                    <div>
                      <p className="text-[10px] font-bold text-red-400">
                        Super Admin
                      </p>

                      <p className="mt-1 text-[9px] leading-4 text-slate-500">
                        Pantau performa dan kelola seluruh peternakan.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* USER AREA */}

        <div
          className={`
            shrink-0 border-t border-white/10
            ${
              sidebarCollapsed
                ? 'p-2'
                : 'p-3'
            }
          `}
        >
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-sm font-bold"
                title={
                  user.full_name ||
                  user.username
                }
              >
                {(
                  user.full_name ||
                  user.username ||
                  'U'
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Keluar"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-500 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              >
                ↪
              </button>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3 rounded-xl p-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold">
                  {(
                    user.full_name ||
                    user.username ||
                    'U'
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    {user.full_name ||
                      user.username}
                  </p>

                  <p className="truncate text-[10px] text-slate-500">
                    {isSuperAdmin
                      ? 'Super Admin'
                      : user.role === 'admin'
                      ? 'Admin Peternakan'
                      : 'User'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-slate-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              >
                ↪ Keluar
              </button>
            </>
          )}
        </div>
      </aside>

      {/* MAIN */}

      <div className="flex min-w-0 flex-1 flex-col">

        {/* TOPBAR */}

        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur md:px-6">

          <div className="flex min-w-0 items-center gap-3">

            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
            >
              ☰
            </button>

            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900 md:text-base">
                {pageTitle}
              </h2>

              <p className="hidden truncate text-[10px] text-slate-400 sm:block">
                {isSuperAdmin
                  ? 'Super Admin Control Center'
                  : farmContext?.farmName ||
                    'smartFarm'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-4">

            <div className="hidden rounded-xl bg-slate-100 px-3 py-2 text-right sm:block">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {isSuperAdmin
                  ? 'Monitoring'
                  : 'Peternakan'}
              </p>

              <p className="max-w-[180px] truncate text-xs font-bold text-slate-700">
                {isSuperAdmin
                  ? 'Semua Peternakan'
                  : farmContext?.farmName ||
                    '-'}
              </p>
            </div>

            <div className="flex items-center gap-2">

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">
                {(
                  user.full_name ||
                  user.username ||
                  'U'
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="hidden md:block">
                <p className="max-w-[140px] truncate text-xs font-bold text-slate-800">
                  {user.full_name ||
                    user.username}
                </p>

                <p className="text-[10px] text-slate-400">
                  {isSuperAdmin
                    ? 'Super Admin'
                    : user.role === 'admin'
                    ? 'Admin Peternakan'
                    : 'User'}
                </p>
              </div>

            </div>
          </div>
        </header>

        {/* CONTENT */}

        <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-100">

          <div className="mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-5 md:px-7 lg:px-8 xl:px-10">
            {renderPage()}
          </div>

        </main>

        {/* FOOTER */}

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 text-center">
          <p className="text-[11px] text-slate-400">
            © 2026 smartFarm
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            Developed by Miladi — IT Developer
          </p>
        </footer>

      </div>
    </div>
  )
}

// =====================================================
// SIDEBAR ITEM
// =====================================================

function SidebarItem({
  item,
  active,
  collapsed,
  onClick,
  special = false,
}) {
  return (
    <div className="group relative">

      <button
        type="button"
        onClick={onClick}
        className={`
          flex h-11 w-full items-center
          rounded-xl
          text-left text-xs font-medium
          transition-all duration-200
          ${
            collapsed
              ? 'justify-center px-0'
              : 'gap-3 px-3'
          }
          ${
            active
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
              : special
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }
        `}
      >
        <span
          className={`
            flex h-8 w-8 shrink-0 items-center justify-center
            rounded-lg text-sm
            transition
            ${
              active
                ? 'bg-white/15'
                : 'bg-white/5 group-hover:bg-white/10'
            }
          `}
        >
          {item.icon}
        </span>

        {!collapsed && (
          <span className="min-w-0 flex-1 truncate">
            {item.label}
          </span>
        )}

        {!collapsed && active && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
        )}
      </button>

      {collapsed && (
        <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[60] hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover:opacity-100 lg:block">
          {item.label}

          <span className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1 -translate-y-1/2 rotate-45 bg-slate-900" />
        </div>
      )}
    </div>
  )
}

// =====================================================
// ACCESS DENIED
// =====================================================

function AccessDenied({ onBack }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">

      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">
          🔒
        </div>

        <h2 className="mt-5 text-xl font-bold text-slate-900">
          Akses Tidak Diizinkan
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Akun Anda tidak memiliki izin
          untuk membuka halaman ini.
        </p>

        <button
          type="button"
          onClick={onBack}
          className="mt-6 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Kembali ke Dashboard
        </button>

      </div>
    </div>
  )
}

// =====================================================
// FARM DASHBOARD
// =====================================================

function Dashboard({
  user,
  farm,
  data,
  loading,
  formatCurrency,
  onRefresh,
}) {
  const cards = [
    {
      title: 'Total Pemasukan',
      value: formatCurrency(
        data.income
      ),
      icon: '💰',
    },
    {
      title: 'Total Pengeluaran',
      value: formatCurrency(
        data.expense
      ),
      icon: '💸',
    },
    {
      title: 'Keuntungan Bersih',
      value: formatCurrency(
        data.profit
      ),
      icon: '📈',
    },
    {
      title: 'Populasi Ayam',
      value:
        Number(
          data.population || 0
        ).toLocaleString(
          'id-ID'
        ),
      icon: '🐔',
      suffix: ' ekor',
    },
    {
      title: 'Hutang Berjalan',
      value: formatCurrency(
        data.debt
      ),
      icon: '💳',
    },
    {
      title: 'Piutang Berjalan',
      value: formatCurrency(
        data.receivable
      ),
      icon: '🧾',
    },
    {
      title: 'Produksi Telur',
      value:
        Number(
          data.eggProduction || 0
        ).toLocaleString(
          'id-ID'
        ),
      icon: '🥚',
      suffix: ' butir',
    },
    {
      title: 'Kematian Ayam',
      value:
        Number(
          data.deaths || 0
        ).toLocaleString(
          'id-ID'
        ),
      icon: '📉',
      suffix: ' ekor',
    },
  ]

  return (
    <div className="space-y-6">

      {/* HERO */}

      <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-slate-300">
              <span>🐔</span>

              {farm?.farmCode ||
                'SMART FARM'}
            </div>

            <h1 className="text-2xl font-black md:text-3xl">
              Halo,{' '}
              {user.full_name ||
                user.username}
              ! 👋
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Kelola operasional{' '}
              {farm?.farmName ||
                'farm kamu'}{' '}
              dengan smartFarm.
            </p>

            {farm?.packageName && (
              <div className="mt-4 inline-flex rounded-lg bg-red-600/15 px-3 py-1.5 text-xs font-semibold text-red-400">
                Paket {farm.packageName}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 lg:self-center"
          >
            {loading
              ? 'Memuat...'
              : '↻ Refresh Data'}
          </button>

        </div>
      </section>

      {/* SUMMARY */}

      <section>

        <div className="mb-4">
          <h2 className="font-bold text-slate-900">
            Ringkasan
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Kondisi terkini data peternakan.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">

          {cards.map(
            (card) => (
              <DashboardCard
                key={card.title}
                {...card}
              />
            )
          )}

        </div>

      </section>

      {/* FARM + FINANCE */}

      <section className="grid gap-4 lg:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100">
              🏠
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Peternakan Aktif
              </p>

              <h3 className="font-bold text-slate-900">
                {farm?.farmName ||
                  'Belum terhubung'}
              </h3>
            </div>

          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">

            <InfoItem
              label="Kode Farm"
              value={
                farm?.farmCode ||
                '-'
              }
            />

            <InfoItem
              label="Role"
              value={
                user.role === 'admin'
                  ? 'Admin'
                  : 'User'
              }
            />

            <InfoItem
              label="Paket"
              value={
                farm?.packageName ||
                '-'
              }
            />

            <InfoItem
              label="Status"
              value="Aktif"
            />

          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="mb-4 flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
              📊
            </div>

            <div>
              <h3 className="font-bold text-slate-900">
                Kondisi Keuangan
              </h3>

              <p className="text-xs text-slate-500">
                Pemasukan dan pengeluaran.
              </p>
            </div>

          </div>

          <div className="space-y-3">

            <ProgressRow
              label="Pemasukan"
              value={data.income}
              max={Math.max(
                data.income,
                data.expense,
                1
              )}
              type="income"
              formatCurrency={
                formatCurrency
              }
            />

            <ProgressRow
              label="Pengeluaran"
              value={data.expense}
              max={Math.max(
                data.income,
                data.expense,
                1
              )}
              type="expense"
              formatCurrency={
                formatCurrency
              }
            />

          </div>
        </div>

      </section>

    </div>
  )
}

// =====================================================
// DASHBOARD CARD
// =====================================================

function DashboardCard({
  title,
  value,
  icon,
  suffix = '',
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">

      <div className="flex items-start justify-between gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg transition group-hover:bg-red-100">
          {icon}
        </div>

      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-1 truncate text-lg font-black text-slate-900 md:text-xl">

        {value}

        {suffix && (
          <span className="ml-1 text-xs font-medium text-slate-400">
            {suffix}
          </span>
        )}

      </p>
    </div>
  )
}

// =====================================================
// INFO ITEM
// =====================================================

function InfoItem({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">

      <p className="text-[10px] font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-bold text-slate-800">
        {value}
      </p>

    </div>
  )
}

// =====================================================
// PROGRESS
// =====================================================

function ProgressRow({
  label,
  value,
  max,
  type,
  formatCurrency,
}) {
  const percentage =
    max > 0
      ? Math.min(
          100,
          (value / max) * 100
        )
      : 0

  return (
    <div>

      <div className="mb-1 flex items-center justify-between">

        <span className="text-xs font-medium text-slate-500">
          {label}
        </span>

        <span className="text-xs font-bold text-slate-700">
          {formatCurrency(value)}
        </span>

      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">

        <div
          className={`h-full rounded-full transition-all duration-700 ${
            type === 'income'
              ? 'bg-emerald-500'
              : 'bg-red-500'
          }`}
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>
    </div>
  )
}

export default App