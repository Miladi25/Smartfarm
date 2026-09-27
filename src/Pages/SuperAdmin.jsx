import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function SuperAdmin({
  user,
  farm,
  mode = 'dashboard',
}) {
  const [farms, setFarms] = useState([])
  const [profiles, setProfiles] = useState([])
  const [transactions, setTransactions] = useState([])
  const [populations, setPopulations] = useState([])
  const [eggProductions, setEggProductions] =
    useState([])
  const [deaths, setDeaths] = useState([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  const [selectedFarm, setSelectedFarm] =
    useState(null)

  const [showFarmModal, setShowFarmModal] =
    useState(false)

  const [showAdminModal, setShowAdminModal] =
    useState(false)

  const [editingFarm, setEditingFarm] =
    useState(null)

  const [editingAdmin, setEditingAdmin] =
    useState(null)

  const [search, setSearch] =
    useState('')

  const [farmForm, setFarmForm] =
    useState({
      name: '',
      owner_name: '',
      phone: '',
      address: '',
      package_name: 'Basic',
      status: 'active',
    })

  const [adminForm, setAdminForm] =
    useState({
      username: '',
      password: '',
      full_name: '',
      farm_id: '',
    })

  // =====================================================
  // LOAD ALL DATA
  // =====================================================

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      const [
        farmsResult,
        profilesResult,
        transactionsResult,
        populationsResult,
        productionResult,
        deathsResult,
      ] = await Promise.all([
        supabase
          .from('farms')
          .select('*')
          .order('created_at', {
            ascending: true,
          }),

        supabase
          .from('profiles')
          .select(
            'id, username, full_name, role, farm_id, is_super_admin, created_at'
          )
          .order('created_at', {
            ascending: true,
          }),

        supabase
          .from('transactions')
          .select('*'),

        supabase
          .from('chicken_population')
          .select('*'),

        supabase
          .from('egg_production')
          .select('*'),

        supabase
          .from('chicken_deaths')
          .select('*'),
      ])

      if (farmsResult.error) {
        throw farmsResult.error
      }

      if (profilesResult.error) {
        throw profilesResult.error
      }

      setFarms(
        farmsResult.data || []
      )

      setProfiles(
        profilesResult.data || []
      )

      setTransactions(
        transactionsResult.error
          ? []
          : transactionsResult.data || []
      )

      setPopulations(
        populationsResult.error
          ? []
          : populationsResult.data || []
      )

      setEggProductions(
        productionResult.error
          ? []
          : productionResult.data || []
      )

      setDeaths(
        deathsResult.error
          ? []
          : deathsResult.data || []
      )
    } catch (err) {
      console.error(
        'Gagal memuat data Super Admin:',
        err
      )

      setError(
        err?.message ||
          'Gagal memuat data sistem.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.is_super_admin) {
      loadData()
    }
  }, [user])

  // =====================================================
  // HELPERS
  // =====================================================

  const formatCurrency = (value) => {
    return new Intl.NumberFormat(
      'id-ID',
      {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }
    ).format(Number(value) || 0)
  }

  const formatNumber = (value) => {
    return Number(
      value || 0
    ).toLocaleString('id-ID')
  }

  const getTransactionType = (
    transaction
  ) => {
    return String(
      transaction?.type || ''
    ).toLowerCase()
  }

  const getPopulationValue = (
    row
  ) => {
    if (
      row?.current_population !==
        undefined &&
      row?.current_population !==
        null
    ) {
      return (
        Number(
          row.current_population
        ) || 0
      )
    }

    if (
      row?.quantity !== undefined &&
      row?.quantity !== null
    ) {
      return (
        Number(row.quantity) || 0
      )
    }

    const initial =
      Number(
        row?.initial_population
      ) || 0

    const incoming =
      Number(row?.incoming) || 0

    const outgoing =
      Number(row?.outgoing) || 0

    const death =
      Number(
        row?.deaths
      ) || 0

    return (
      initial +
      incoming -
      outgoing -
      death
    )
  }

  const getEggValue = (row) => {
    return (
      Number(
        row?.total_eggs ??
          row?.quantity ??
          row?.egg_count ??
          0
      ) || 0
    )
  }

  const getDeathValue = (row) => {
    return (
      Number(
        row?.death_count ??
          row?.deaths ??
          row?.quantity ??
          0
      ) || 0
    )
  }

  // =====================================================
  // FARM STATISTICS
  // =====================================================

  const farmStats = useMemo(() => {
    return farms.map((farmItem) => {
      const farmId =
        farmItem.id

      const farmProfiles =
        profiles.filter(
          (profile) =>
            profile.farm_id ===
            farmId
        )

      const admins =
        farmProfiles.filter(
          (profile) =>
            profile.role ===
              'admin' &&
            !profile.is_super_admin
        )

      const users =
        farmProfiles.filter(
          (profile) =>
            profile.role ===
              'user'
        )

      const farmTransactions =
        transactions.filter(
          (row) =>
            row.farm_id ===
            farmId
        )

      let income = 0
      let expense = 0

      farmTransactions.forEach(
        (transaction) => {
          const amount =
            Number(
              transaction.amount
            ) || 0

          const type =
            getTransactionType(
              transaction
            )

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

      const farmPopulation =
        populations
          .filter(
            (row) =>
              row.farm_id ===
              farmId
          )
          .reduce(
            (
              total,
              row
            ) =>
              total +
              getPopulationValue(
                row
              ),
            0
          )

      const farmEggProduction =
        eggProductions
          .filter(
            (row) =>
              row.farm_id ===
              farmId
          )
          .reduce(
            (
              total,
              row
            ) =>
              total +
              getEggValue(
                row
              ),
            0
          )

      const farmDeaths =
        deaths
          .filter(
            (row) =>
              row.farm_id ===
              farmId
          )
          .reduce(
            (
              total,
              row
            ) =>
              total +
              getDeathValue(
                row
              ),
            0
          )

      return {
        ...farmItem,
        adminCount:
          admins.length,
        userCount:
          users.length,
        totalMembers:
          farmProfiles.length,
        income,
        expense,
        profit:
          income - expense,
        population:
          farmPopulation,
        eggProduction:
          farmEggProduction,
        deaths:
          farmDeaths,
      }
    })
  }, [
    farms,
    profiles,
    transactions,
    populations,
    eggProductions,
    deaths,
  ])

  // =====================================================
  // GLOBAL SUMMARY
  // =====================================================

  const summary = useMemo(() => {
    return {
      totalFarms:
        farms.length,

      activeFarms:
        farms.filter(
          (item) =>
            item.status ===
            'active'
        ).length,

      inactiveFarms:
        farms.filter(
          (item) =>
            item.status ===
            'inactive'
        ).length,

      suspendedFarms:
        farms.filter(
          (item) =>
            item.status ===
            'suspended'
        ).length,

      totalAdmins:
        profiles.filter(
          (profile) =>
            profile.role ===
              'admin' &&
            !profile.is_super_admin
        ).length,

      totalUsers:
        profiles.filter(
          (profile) =>
            profile.role ===
            'user'
        ).length,

      totalIncome:
        farmStats.reduce(
          (
            total,
            item
          ) =>
            total +
            item.income,
          0
        ),

      totalExpense:
        farmStats.reduce(
          (
            total,
            item
          ) =>
            total +
            item.expense,
          0
        ),

      totalPopulation:
        farmStats.reduce(
          (
            total,
            item
          ) =>
            total +
            item.population,
          0
        ),

      totalEggProduction:
        farmStats.reduce(
          (
            total,
            item
          ) =>
            total +
            item.eggProduction,
          0
        ),

      totalDeaths:
        farmStats.reduce(
          (
            total,
            item
          ) =>
            total +
            item.deaths,
          0
        ),
    }
  }, [
    farms,
    profiles,
    farmStats,
  ])

  // =====================================================
  // SEARCH FARM
  // =====================================================

  const filteredFarms =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase()

      if (!keyword) {
        return farmStats
      }

      return farmStats.filter(
        (item) =>
          String(
            item.name || ''
          )
            .toLowerCase()
            .includes(keyword) ||
          String(
            item.farm_code || ''
          )
            .toLowerCase()
            .includes(keyword) ||
          String(
            item.owner_name || ''
          )
            .toLowerCase()
            .includes(keyword) ||
          String(
            item.phone || ''
          )
            .toLowerCase()
            .includes(keyword)
      )
    }, [
      farmStats,
      search,
    ])

  // =====================================================
  // FARM CODE
  // =====================================================

  const generateFarmCode =
    () => {
      const numbers =
        farms
          .map((item) => {
            const match =
              String(
                item.farm_code || ''
              ).match(
                /SF-(\d+)/
              )

            return match
              ? Number(
                  match[1]
                )
              : 0
          })

      const highest =
        Math.max(
          0,
          ...numbers
        )

      return `SF-${String(
        highest + 1
      ).padStart(3, '0')}`
    }

  // =====================================================
  // OPEN ADD FARM
  // =====================================================

  const openAddFarm = () => {
    setEditingFarm(null)

    setFarmForm({
      name: '',
      owner_name: '',
      phone: '',
      address: '',
      package_name: 'Basic',
      status: 'active',
    })

    setError('')
    setSuccess('')
    setShowFarmModal(true)
  }

  // =====================================================
  // OPEN EDIT FARM
  // =====================================================

  const openEditFarm = (
    farmItem
  ) => {
    setEditingFarm(
      farmItem
    )

    setFarmForm({
      name:
        farmItem.name || '',
      owner_name:
        farmItem.owner_name ||
        '',
      phone:
        farmItem.phone || '',
      address:
        farmItem.address ||
        '',
      package_name:
        farmItem.package_name ||
        'Basic',
      status:
        farmItem.status ||
        'active',
    })

    setError('')
    setSuccess('')
    setShowFarmModal(true)
  }

  // =====================================================
  // SAVE FARM
  // =====================================================

  const handleSaveFarm =
    async (event) => {
      event.preventDefault()

      if (
        !farmForm.name.trim()
      ) {
        setError(
          'Nama peternakan wajib diisi.'
        )

        return
      }

      setSaving(true)
      setError('')
      setSuccess('')

      try {
        if (editingFarm) {
          const {
            error: updateError,
          } = await supabase
            .from('farms')
            .update({
              name:
                farmForm.name.trim(),

              owner_name:
                farmForm.owner_name.trim() ||
                null,

              phone:
                farmForm.phone.trim() ||
                null,

              address:
                farmForm.address.trim() ||
                null,

              package_name:
                farmForm.package_name,

              status:
                farmForm.status,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              'id',
              editingFarm.id
            )

          if (updateError) {
            throw updateError
          }

          setSuccess(
            'Data peternakan berhasil diperbarui.'
          )
        } else {
          const farmCode =
            generateFarmCode()

          const {
            error: insertError,
          } = await supabase
            .from('farms')
            .insert({
              name:
                farmForm.name.trim(),

              farm_code:
                farmCode,

              owner_name:
                farmForm.owner_name.trim() ||
                null,

              phone:
                farmForm.phone.trim() ||
                null,

              address:
                farmForm.address.trim() ||
                null,

              package_name:
                farmForm.package_name,

              status:
                farmForm.status,
            })

          if (insertError) {
            throw insertError
          }

          setSuccess(
            `Peternakan berhasil ditambahkan dengan kode ${farmCode}.`
          )
        }

        setShowFarmModal(false)

        await loadData()
      } catch (err) {
        console.error(
          'Gagal menyimpan farm:',
          err
        )

        setError(
          err?.message ||
            'Gagal menyimpan peternakan.'
        )
      } finally {
        setSaving(false)
      }
    }

  // =====================================================
  // DELETE FARM
  // =====================================================

  const handleDeleteFarm =
    async (farmItem) => {
      const members =
        profiles.filter(
          (profile) =>
            profile.farm_id ===
            farmItem.id
        )

      if (
        members.length > 0
      ) {
        setError(
          'Peternakan tidak dapat dihapus karena masih memiliki akun. Hapus atau pindahkan Admin Peternakan terlebih dahulu.'
        )

        return
      }

      const confirmed =
        window.confirm(
          `Hapus peternakan "${farmItem.name}"?\n\nData peternakan akan dihapus.`
        )

      if (!confirmed) return

      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const {
          error: deleteError,
        } = await supabase
          .from('farms')
          .delete()
          .eq(
            'id',
            farmItem.id
          )

        if (deleteError) {
          throw deleteError
        }

        setSuccess(
          'Peternakan berhasil dihapus.'
        )

        if (
          selectedFarm?.id ===
          farmItem.id
        ) {
          setSelectedFarm(null)
        }

        await loadData()
      } catch (err) {
        console.error(
          'Gagal menghapus farm:',
          err
        )

        setError(
          err?.message ||
            'Gagal menghapus peternakan.'
        )
      } finally {
        setSaving(false)
      }
    }

  // =====================================================
  // TOGGLE STATUS
  // =====================================================

  const handleChangeFarmStatus =
    async (
      farmItem,
      status
    ) => {
      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const {
          error: updateError,
        } = await supabase
          .from('farms')
          .update({
            status,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            farmItem.id
          )

        if (updateError) {
          throw updateError
        }

        setSuccess(
          `Status ${farmItem.name} diubah menjadi ${getStatusLabel(
            status
          )}.`
        )

        await loadData()
      } catch (err) {
        console.error(
          'Gagal mengubah status farm:',
          err
        )

        setError(
          err?.message ||
            'Gagal mengubah status peternakan.'
        )
      } finally {
        setSaving(false)
      }
    }

  // =====================================================
  // OPEN ADD ADMIN
  // =====================================================

  const openAddAdmin = (
    farmItem
  ) => {
    setEditingAdmin(null)

    setAdminForm({
      username: '',
      password: '',
      full_name: '',
      farm_id:
        farmItem?.id || '',
    })

    setError('')
    setSuccess('')
    setShowAdminModal(true)
  }

  // =====================================================
  // OPEN EDIT ADMIN
  // =====================================================

  const openEditAdmin =
    (admin) => {
      setEditingAdmin(
        admin
      )

      setAdminForm({
        username:
          admin.username || '',
        password: '',
        full_name:
          admin.full_name || '',
        farm_id:
          admin.farm_id || '',
      })

      setError('')
      setSuccess('')
      setShowAdminModal(true)
    }

  // =====================================================
  // SAVE ADMIN
  // =====================================================

  const handleSaveAdmin =
    async (event) => {
      event.preventDefault()

      if (
        !adminForm.username.trim()
      ) {
        setError(
          'Username admin wajib diisi.'
        )

        return
      }

      if (
        !adminForm.full_name.trim()
      ) {
        setError(
          'Nama lengkap admin wajib diisi.'
        )

        return
      }

      if (
        !adminForm.farm_id
      ) {
        setError(
          'Pilih peternakan untuk Admin Peternakan.'
        )

        return
      }

      if (
        !editingAdmin &&
        !adminForm.password.trim()
      ) {
        setError(
          'Password wajib diisi untuk admin baru.'
        )

        return
      }

      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const duplicateQuery =
          supabase
            .from('profiles')
            .select(
              'id, username'
            )
            .eq(
              'username',
              adminForm.username.trim()
            )

        if (
          editingAdmin
        ) {
          duplicateQuery.neq(
            'id',
            editingAdmin.id
          )
        }

        const {
          data: duplicate,
          error:
            duplicateError,
        } =
          await duplicateQuery.maybeSingle()

        if (duplicateError) {
          throw duplicateError
        }

        if (duplicate) {
          setError(
            'Username tersebut sudah digunakan.'
          )

          return
        }

        if (
          editingAdmin
        ) {
          const updateData = {
            username:
              adminForm.username.trim(),

            full_name:
              adminForm.full_name.trim(),

            role: 'admin',

            farm_id:
              adminForm.farm_id,

            is_super_admin:
              false,
          }

          if (
            adminForm.password.trim()
          ) {
            updateData.password =
              adminForm.password.trim()
          }

          const {
            error: updateError,
          } = await supabase
            .from('profiles')
            .update(
              updateData
            )
            .eq(
              'id',
              editingAdmin.id
            )

          if (updateError) {
            throw updateError
          }

          setSuccess(
            'Admin Peternakan berhasil diperbarui.'
          )
        } else {
          const {
            error: insertError,
          } = await supabase
            .from('profiles')
            .insert({
              username:
                adminForm.username.trim(),

              password:
                adminForm.password.trim(),

              full_name:
                adminForm.full_name.trim(),

              role: 'admin',

              farm_id:
                adminForm.farm_id,

              is_super_admin:
                false,
            })

          if (insertError) {
            throw insertError
          }

          setSuccess(
            'Admin Peternakan berhasil ditambahkan.'
          )
        }

        setShowAdminModal(false)

        await loadData()
      } catch (err) {
        console.error(
          'Gagal menyimpan admin:',
          err
        )

        setError(
          err?.message ||
            'Gagal menyimpan Admin Peternakan.'
        )
      } finally {
        setSaving(false)
      }
    }

  // =====================================================
  // DELETE ADMIN
  // =====================================================

  const handleDeleteAdmin =
    async (admin) => {
      if (
        admin.is_super_admin
      ) {
        setError(
          'Super Admin tidak dapat dihapus dari halaman ini.'
        )

        return
      }

      const confirmed =
        window.confirm(
          `Hapus Admin Peternakan "${admin.full_name || admin.username}"?`
        )

      if (!confirmed) return

      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const {
          error: deleteError,
        } = await supabase
          .from('profiles')
          .delete()
          .eq(
            'id',
            admin.id
          )

        if (deleteError) {
          throw deleteError
        }

        setSuccess(
          'Admin Peternakan berhasil dihapus.'
        )

        await loadData()
      } catch (err) {
        console.error(
          'Gagal menghapus admin:',
          err
        )

        setError(
          err?.message ||
            'Gagal menghapus Admin Peternakan.'
        )
      } finally {
        setSaving(false)
      }
    }

  // =====================================================
  // GET ADMINS
  // =====================================================

  const adminProfiles =
    useMemo(() => {
      return profiles.filter(
        (profile) =>
          profile.role ===
            'admin' &&
          !profile.is_super_admin
      )
    }, [profiles])

  // =====================================================
  // GET USERS BY FARM
  // =====================================================

  const getFarmUsers = (
    farmId
  ) => {
    return profiles.filter(
      (profile) =>
        profile.farm_id ===
          farmId &&
        profile.role ===
          'user'
    )
  }

  const getFarmAdmins = (
    farmId
  ) => {
    return profiles.filter(
      (profile) =>
        profile.farm_id ===
          farmId &&
        profile.role ===
          'admin' &&
        !profile.is_super_admin
    )
  }

  // =====================================================
  // STATUS LABEL
  // =====================================================

  function getStatusLabel(
    status
  ) {
    if (
      status === 'active'
    ) {
      return 'Aktif'
    }

    if (
      status === 'inactive'
    ) {
      return 'Nonaktif'
    }

    if (
      status === 'suspended'
    ) {
      return 'Ditangguhkan'
    }

    return status
  }

  // =====================================================
  // STATUS STYLE
  // =====================================================

  function getStatusClass(
    status
  ) {
    if (
      status === 'active'
    ) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }

    if (
      status === 'suspended'
    ) {
      return 'bg-amber-50 text-amber-700 border-amber-200'
    }

    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  // =====================================================
  // MODE: ADD FARM
  // =====================================================

  if (
    mode === 'add-farm'
  ) {
    return (
      <div className="space-y-6">

        <PageHeader
          icon="➕"
          title="Tambah Peternakan"
          description="Daftarkan peternakan baru ke dalam sistem smartFarm."
        />

        {error && (
          <Alert
            type="error"
            message={error}
          />
        )}

        {success && (
          <Alert
            type="success"
            message={success}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

          <form
            onSubmit={
              handleSaveFarm
            }
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
          >

            <div className="mb-6">

              <p className="text-xs font-bold uppercase tracking-wider text-red-600">
                Data Peternakan
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-900">
                Informasi Peternakan
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Isi informasi dasar peternakan yang akan didaftarkan.
              </p>

            </div>

            <FarmForm
              form={
                farmForm
              }
              setForm={
                setFarmForm
              }
            />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Menyimpan...'
                  : '✓ Tambah Peternakan'}
              </button>

            </div>

          </form>

          <div className="space-y-4">

            <InfoPanel
              icon="🏢"
              title="Kode Peternakan"
              text="Kode farm akan dibuat otomatis oleh sistem seperti SF-001, SF-002, dan seterusnya."
            />

            <InfoPanel
              icon="👨‍💼"
              title="Admin Peternakan"
              text="Setelah peternakan dibuat, Super Admin dapat menambahkan Admin Peternakan untuk mengelolanya."
            />

            <InfoPanel
              icon="👤"
              title="User"
              text="User tidak dibuat oleh Super Admin. Admin Peternakan akan mengelola user dari peternakannya sendiri."
            />

          </div>

        </div>

      </div>
    )
  }

  // =====================================================
  // MODE: MANAGE FARMS
  // =====================================================

  if (
    mode === 'manage-farms'
  ) {
    return (
      <div className="space-y-6">

        <PageHeader
          icon="🏢"
          title="Kelola Peternakan"
          description="Kelola peternakan dan Admin Peternakan yang terdaftar di smartFarm."
          action={
            <button
              type="button"
              onClick={
                openAddFarm
              }
              className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
            >
              ➕ Tambah Peternakan
            </button>
          }
        />

        {error && (
          <Alert
            type="error"
            message={error}
          />
        )}

        {success && (
          <Alert
            type="success"
            message={success}
          />
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">

          <SummaryCard
            title="Total Peternakan"
            value={
              summary.totalFarms
            }
            icon="🏢"
          />

          <SummaryCard
            title="Peternakan Aktif"
            value={
              summary.activeFarms
            }
            icon="🟢"
          />

          <SummaryCard
            title="Total Admin"
            value={
              summary.totalAdmins
            }
            icon="👨‍💼"
          />

          <SummaryCard
            title="Total User"
            value={
              summary.totalUsers
            }
            icon="👤"
          />

        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">

          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>

              <h2 className="font-black text-slate-900">
                Daftar Peternakan
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {filteredFarms.length}{' '}
                peternakan ditampilkan.
              </p>

            </div>

            <div className="relative w-full md:max-w-sm">

              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                🔎
              </span>

              <input
                type="text"
                value={
                  search
                }
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Cari peternakan..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-red-400 focus:bg-white"
              />

            </div>

          </div>

          {loading ? (
            <LoadingState />
          ) : filteredFarms.length ===
            0 ? (
            <EmptyState
              icon="🏢"
              title="Belum ada peternakan"
              text="Tambahkan peternakan pertama untuk mulai menggunakan smartFarm."
              action={
                <button
                  type="button"
                  onClick={
                    openAddFarm
                  }
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white"
                >
                  ➕ Tambah Peternakan
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">

              {filteredFarms.map(
                (farmItem) => (
                  <FarmManagementCard
                    key={
                      farmItem.id
                    }
                    farmItem={
                      farmItem
                    }
                    admins={getFarmAdmins(
                      farmItem.id
                    )}
                    users={getFarmUsers(
                      farmItem.id
                    )}
                    onView={() =>
                      setSelectedFarm(
                        farmItem
                      )
                    }
                    onEdit={() =>
                      openEditFarm(
                        farmItem
                      )
                    }
                    onAddAdmin={() =>
                      openAddAdmin(
                        farmItem
                      )
                    }
                    onEditAdmin={
                      openEditAdmin
                    }
                    onDeleteAdmin={
                      handleDeleteAdmin
                    }
                    onDelete={() =>
                      handleDeleteFarm(
                        farmItem
                      )
                    }
                    onStatusChange={
                      handleChangeFarmStatus
                    }
                  />
                )
              )}

            </div>
          )}

        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="mb-5">

            <h2 className="font-black text-slate-900">
              Admin Peternakan
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Super Admin mengelola akun Admin Peternakan. User dikelola langsung oleh masing-masing Admin.
            </p>

          </div>

          {adminProfiles.length ===
          0 ? (
            <EmptyState
              icon="👨‍💼"
              title="Belum ada Admin Peternakan"
              text="Tambahkan Admin melalui peternakan yang ingin dikelola."
            />
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[720px]">

                <thead>

                  <tr className="border-b border-slate-200 text-left">

                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Admin
                    </th>

                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Peternakan
                    </th>

                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      User
                    </th>

                    <th className="px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Aksi
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {adminProfiles.map(
                    (admin) => {
                      const farmItem =
                        farms.find(
                          (item) =>
                            item.id ===
                            admin.farm_id
                        )

                      const userCount =
                        getFarmUsers(
                          admin.farm_id
                        ).length

                      return (
                        <tr
                          key={
                            admin.id
                          }
                          className="border-b border-slate-100 last:border-0"
                        >

                          <td className="px-3 py-4">

                            <div className="flex items-center gap-3">

                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-xs font-black text-red-700">
                                {(
                                  admin.full_name ||
                                  admin.username ||
                                  'A'
                                )
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}
                              </div>

                              <div>

                                <p className="text-xs font-bold text-slate-800">
                                  {admin.full_name ||
                                    admin.username}
                                </p>

                                <p className="text-[10px] text-slate-400">
                                  @{admin.username}
                                </p>

                              </div>

                            </div>

                          </td>

                          <td className="px-3 py-4">

                            <p className="text-xs font-bold text-slate-800">
                              {farmItem?.name ||
                                'Belum terhubung'}
                            </p>

                            <p className="text-[10px] text-slate-400">
                              {farmItem?.farm_code ||
                                '-'}
                            </p>

                          </td>

                          <td className="px-3 py-4">

                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                              {userCount}{' '}
                              User
                            </span>

                          </td>

                          <td className="px-3 py-4">

                            <div className="flex justify-end gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  openEditAdmin(
                                    admin
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteAdmin(
                                    admin
                                  )
                                }
                                disabled={
                                  saving
                                }
                                className="rounded-lg border border-red-200 px-3 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
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
          )}

        </section>

        {showFarmModal && (
          <FarmModal
            editingFarm={
              editingFarm
            }
            form={
              farmForm
            }
            setForm={
              setFarmForm
            }
            saving={
              saving
            }
            onClose={() =>
              setShowFarmModal(
                false
              )
            }
            onSubmit={
              handleSaveFarm
            }
          />
        )}

        {showAdminModal && (
          <AdminModal
            editingAdmin={
              editingAdmin
            }
            form={
              adminForm
            }
            setForm={
              setAdminForm
            }
            farms={
              farms
            }
            saving={
              saving
            }
            onClose={() =>
              setShowAdminModal(
                false
              )
            }
            onSubmit={
              handleSaveAdmin
            }
          />
        )}

        {selectedFarm && (
          <FarmDetailModal
            farmItem={
              selectedFarm
            }
            admins={getFarmAdmins(
              selectedFarm.id
            )}
            users={getFarmUsers(
              selectedFarm.id
            )}
            onClose={() =>
              setSelectedFarm(
                null
              )
            }
            formatCurrency={
              formatCurrency
            }
            formatNumber={
              formatNumber
            }
          />
        )}

      </div>
    )
  }

  // =====================================================
  // DASHBOARD MODE
  // =====================================================

  return (
    <div className="space-y-6">

      <PageHeader
        icon="📊"
        title="Dashboard Performa"
        description="Pantau performa seluruh peternakan yang terdaftar di smartFarm."
        action={
          <button
            type="button"
            onClick={
              loadData
            }
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loading
              ? 'Memuat...'
              : '↻ Refresh'}
          </button>
        }
      />

      {error && (
        <Alert
          type="error"
          message={error}
        />
      )}

      {success && (
        <Alert
          type="success"
          message={success}
        />
      )}

      {/* =================================================
          GLOBAL SUMMARY
      ================================================= */}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">

        <SummaryCard
          title="Total Peternakan"
          value={
            summary.totalFarms
          }
          icon="🏢"
        />

        <SummaryCard
          title="Peternakan Aktif"
          value={
            summary.activeFarms
          }
          icon="🟢"
        />

        <SummaryCard
          title="Total Admin"
          value={
            summary.totalAdmins
          }
          icon="👨‍💼"
        />

        <SummaryCard
          title="Total User"
          value={
            summary.totalUsers
          }
          icon="👤"
        />

        <SummaryCard
          title="Total Pemasukan"
          value={formatCurrency(
            summary.totalIncome
          )}
          icon="💰"
          compact
        />

        <SummaryCard
          title="Total Pengeluaran"
          value={formatCurrency(
            summary.totalExpense
          )}
          icon="💸"
          compact
        />

        <SummaryCard
          title="Total Populasi"
          value={`${formatNumber(
            summary.totalPopulation
          )} ekor`}
          icon="🐔"
          compact
        />

        <SummaryCard
          title="Produksi Telur"
          value={`${formatNumber(
            summary.totalEggProduction
          )} butir`}
          icon="🥚"
          compact
        />

      </section>

      {/* =================================================
          PERFORMANCE OVERVIEW
      ================================================= */}

      <section className="grid gap-4 lg:grid-cols-3">

        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl lg:col-span-2">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <div className="mb-2 inline-flex rounded-full bg-red-500/10 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-red-400">
                Control Center
              </div>

              <h2 className="text-xl font-black">
                Performa Seluruh Peternakan
              </h2>

              <p className="mt-2 max-w-xl text-xs leading-5 text-slate-400">
                Data berikut merupakan agregasi dari seluruh peternakan yang terdaftar pada smartFarm.
              </p>

            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">

              <p className="text-[9px] uppercase tracking-wider text-slate-500">
                Keuntungan Bersih
              </p>

              <p className="mt-1 text-xl font-black text-white">
                {formatCurrency(
                  summary.totalIncome -
                    summary.totalExpense
                )}
              </p>

            </div>

          </div>

        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100">
              📡
            </div>

            <div>

              <h3 className="font-black text-slate-900">
                Status Sistem
              </h3>

              <p className="text-xs text-slate-500">
                Kondisi peternakan terdaftar.
              </p>

            </div>

          </div>

          <div className="mt-5 space-y-3">

            <StatusRow
              label="Aktif"
              value={
                summary.activeFarms
              }
              className="text-emerald-600"
            />

            <StatusRow
              label="Nonaktif"
              value={
                summary.inactiveFarms
              }
              className="text-slate-500"
            />

            <StatusRow
              label="Ditangguhkan"
              value={
                summary.suspendedFarms
              }
              className="text-amber-600"
            />

          </div>

        </div>

      </section>

      {/* =================================================
          FINANCIAL PERFORMANCE
      ================================================= */}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">

        <div className="mb-5">

          <h2 className="font-black text-slate-900">
            Performa Keuangan
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Rekapitulasi keuangan seluruh peternakan.
          </p>

        </div>

        <div className="grid gap-4 md:grid-cols-3">

          <PerformanceBox
            title="Pemasukan"
            value={formatCurrency(
              summary.totalIncome
            )}
            icon="💰"
            description="Total pemasukan"
          />

          <PerformanceBox
            title="Pengeluaran"
            value={formatCurrency(
              summary.totalExpense
            )}
            icon="💸"
            description="Total pengeluaran"
          />

          <PerformanceBox
            title="Keuntungan Bersih"
            value={formatCurrency(
              summary.totalIncome -
                summary.totalExpense
            )}
            icon="📈"
            description="Pemasukan dikurangi pengeluaran"
          />

        </div>

      </section>

      {/* =================================================
          PRODUCTION PERFORMANCE
      ================================================= */}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">

        <div className="mb-5">

          <h2 className="font-black text-slate-900">
            Performa Produksi
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Ringkasan operasional peternakan.
          </p>

        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">

          <ProductionBox
            title="Populasi Ayam"
            value={`${formatNumber(
              summary.totalPopulation
            )} ekor`}
            icon="🐔"
          />

          <ProductionBox
            title="Produksi Telur"
            value={`${formatNumber(
              summary.totalEggProduction
            )} butir`}
            icon="🥚"
          />

          <ProductionBox
            title="Kematian Ayam"
            value={`${formatNumber(
              summary.totalDeaths
            )} ekor`}
            icon="📉"
          />

        </div>

      </section>

      {/* =================================================
          FARM PERFORMANCE
      ================================================= */}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

          <div>

            <h2 className="font-black text-slate-900">
              Performa Setiap Peternakan
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Perbandingan data seluruh peternakan.
            </p>

          </div>

          <div className="relative w-full md:max-w-xs">

            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
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
              placeholder="Cari peternakan..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-red-400 focus:bg-white"
            />

          </div>

        </div>

        {loading ? (
          <LoadingState />
        ) : filteredFarms.length ===
          0 ? (
          <EmptyState
            icon="🏢"
            title="Belum ada peternakan"
            text="Belum ada peternakan yang terdaftar."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">

            {filteredFarms.map(
              (farmItem) => (
                <FarmPerformanceCard
                  key={
                    farmItem.id
                  }
                  farmItem={
                    farmItem
                  }
                  onClick={() =>
                    setSelectedFarm(
                      farmItem
                    )
                  }
                  formatCurrency={
                    formatCurrency
                  }
                  formatNumber={
                    formatNumber
                  }
                />
              )
            )}

          </div>
        )}

      </section>

      {/* =================================================
          ADMIN USER SUMMARY
      ================================================= */}

      <section className="grid gap-4 lg:grid-cols-2">

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100">
              👨‍💼
            </div>

            <div>

              <h2 className="font-black text-slate-900">
                Admin Peternakan
              </h2>

              <p className="text-xs text-slate-500">
                Admin yang mengelola masing-masing farm.
              </p>

            </div>

          </div>

          <div className="mt-5 text-3xl font-black text-slate-900">
            {summary.totalAdmins}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Admin Peternakan terdaftar
          </p>

        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
              👤
            </div>

            <div>

              <h2 className="font-black text-slate-900">
                User Peternakan
              </h2>

              <p className="text-xs text-slate-500">
                User yang menggunakan masing-masing farm.
              </p>

            </div>

          </div>

          <div className="mt-5 text-3xl font-black text-slate-900">
            {summary.totalUsers}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            User terdaftar di seluruh farm
          </p>

        </div>

      </section>

      {/* =================================================
          DETAIL MODAL
      ================================================= */}

      {selectedFarm && (
        <FarmDetailModal
          farmItem={
            selectedFarm
          }
          admins={getFarmAdmins(
            selectedFarm.id
          )}
          users={getFarmUsers(
            selectedFarm.id
          )}
          onClose={() =>
            setSelectedFarm(
              null
            )
          }
          formatCurrency={
            formatCurrency
          }
          formatNumber={
            formatNumber
          }
        />
      )}

    </div>
  )
}

// =====================================================
// PAGE HEADER
// =====================================================

function PageHeader({
  icon,
  title,
  description,
  action,
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

      <div className="flex items-start gap-3">

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-xl">
          {icon}
        </div>

        <div>

          <h1 className="text-xl font-black text-slate-900 md:text-2xl">
            {title}
          </h1>

          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            {description}
          </p>

        </div>

      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}

    </div>
  )
}

// =====================================================
// SUMMARY CARD
// =====================================================

function SummaryCard({
  title,
  value,
  icon,
  compact = false,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

      <div className="flex items-start justify-between gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
          {icon}
        </div>

      </div>

      <p className="mt-4 text-[10px] font-semibold text-slate-400">
        {title}
      </p>

      <p
        className={`mt-1 break-words font-black text-slate-900 ${
          compact
            ? 'text-base md:text-lg'
            : 'text-xl md:text-2xl'
        }`}
      >
        {value}
      </p>

    </div>
  )
}

// =====================================================
// STATUS ROW
// =====================================================

function StatusRow({
  label,
  value,
  className,
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">

      <span className="text-xs font-medium text-slate-600">
        {label}
      </span>

      <span
        className={`text-sm font-black ${className}`}
      >
        {value}
      </span>

    </div>
  )
}

// =====================================================
// PERFORMANCE BOX
// =====================================================

function PerformanceBox({
  title,
  value,
  icon,
  description,
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
          {icon}
        </div>

        <div>

          <p className="text-xs font-bold text-slate-700">
            {title}
          </p>

          <p className="text-[10px] text-slate-400">
            {description}
          </p>

        </div>

      </div>

      <p className="mt-5 break-words text-xl font-black text-slate-900">
        {value}
      </p>

    </div>
  )
}

// =====================================================
// PRODUCTION BOX
// =====================================================

function ProductionBox({
  title,
  value,
  icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
          {icon}
        </div>

        <p className="text-xs font-semibold text-slate-500">
          {title}
        </p>

      </div>

      <p className="mt-4 text-lg font-black text-slate-900">
        {value}
      </p>

    </div>
  )
}

// =====================================================
// FARM PERFORMANCE CARD
// =====================================================

function FarmPerformanceCard({
  farmItem,
  onClick,
  formatCurrency,
  formatNumber,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
    >

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div className="flex items-start gap-3">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-lg">
            🏠
          </div>

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="truncate font-black text-slate-900">
                {farmItem.name}
              </h3>

              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                {farmItem.farm_code ||
                  '-'}
              </span>

            </div>

            <p className="mt-1 truncate text-[10px] text-slate-400">
              {farmItem.owner_name ||
                'Pemilik belum diisi'}
            </p>

          </div>

        </div>

        <span
          className={`shrink-0 self-start rounded-full border px-2.5 py-1 text-[9px] font-bold ${getFarmStatusClass(
            farmItem.status
          )}`}
        >
          {getStatusLabel(
            farmItem.status
          )}
        </span>

      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">

        <MiniMetric
          label="Pemasukan"
          value={formatCurrency(
            farmItem.income
          )}
        />

        <MiniMetric
          label="Pengeluaran"
          value={formatCurrency(
            farmItem.expense
          )}
        />

        <MiniMetric
          label="Populasi"
          value={`${formatNumber(
            farmItem.population
          )} ekor`}
        />

        <MiniMetric
          label="Telur"
          value={`${formatNumber(
            farmItem.eggProduction
          )} butir`}
        />

      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">

        <SmallMetric
          label="Keuntungan"
          value={formatCurrency(
            farmItem.profit
          )}
        />

        <SmallMetric
          label="Admin"
          value={`${farmItem.adminCount} akun`}
        />

        <SmallMetric
          label="User"
          value={`${farmItem.userCount} akun`}
        />

      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">

        <span className="text-[10px] text-slate-400">
          Klik untuk melihat detail
        </span>

        <span className="text-xs font-bold text-red-600">
          Detail →
        </span>

      </div>

    </button>
  )
}

// =====================================================
// FARM MANAGEMENT CARD
// =====================================================

function FarmManagementCard({
  farmItem,
  admins,
  users,
  onView,
  onEdit,
  onAddAdmin,
  onEditAdmin,
  onDeleteAdmin,
  onDelete,
  onStatusChange,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div className="flex min-w-0 items-start gap-3">

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100">
            🏢
          </div>

          <div className="min-w-0">

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="truncate font-black text-slate-900">
                {farmItem.name}
              </h3>

              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                {farmItem.farm_code ||
                  '-'}
              </span>

            </div>

            <p className="mt-1 text-[10px] text-slate-400">
              {farmItem.owner_name ||
                'Pemilik belum diisi'}
            </p>

          </div>

        </div>

        <span
          className={`self-start rounded-full border px-2.5 py-1 text-[9px] font-bold ${getFarmStatusClass(
            farmItem.status
          )}`}
        >
          {getStatusLabel(
            farmItem.status
          )}
        </span>

      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">

        <SmallMetric
          label="Admin"
          value={
            admins.length
          }
        />

        <SmallMetric
          label="User"
          value={
            users.length
          }
        />

        <SmallMetric
          label="Paket"
          value={
            farmItem.package_name ||
            'Basic'
          }
        />

      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-3">

        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Admin Peternakan
        </p>

        {admins.length ===
        0 ? (
          <p className="text-xs text-slate-400">
            Belum ada Admin Peternakan.
          </p>
        ) : (
          <div className="space-y-2">

            {admins.map(
              (admin) => (
                <div
                  key={
                    admin.id
                  }
                  className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                >

                  <div className="flex min-w-0 items-center gap-2">

                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-[9px] font-bold text-red-700">
                      {(
                        admin.full_name ||
                        admin.username ||
                        'A'
                      )
                        .charAt(
                          0
                        )
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">

                      <p className="truncate text-[10px] font-bold text-slate-700">
                        {admin.full_name ||
                          admin.username}
                      </p>

                      <p className="truncate text-[9px] text-slate-400">
                        @{admin.username}
                      </p>

                    </div>

                  </div>

                  <div className="flex shrink-0 gap-1">

                    <button
                      type="button"
                      onClick={() =>
                        onEditAdmin(
                          admin
                        )
                      }
                      className="rounded-md px-2 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onDeleteAdmin(
                          admin
                        )
                      }
                      className="rounded-md px-2 py-1 text-[9px] font-bold text-red-500 hover:bg-red-50"
                    >
                      Hapus
                    </button>

                  </div>

                </div>
              )
            )}

          </div>
        )}

      </div>

      <div className="mt-4 flex flex-wrap gap-2">

        <button
          type="button"
          onClick={onView}
          className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50"
        >
          👁 Detail
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50"
        >
          ✏️ Edit
        </button>

        <button
          type="button"
          onClick={onAddAdmin}
          className="rounded-lg bg-red-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-red-700"
        >
          👨‍💼 Tambah Admin
        </button>

        <button
          type="button"
          onClick={() =>
            onStatusChange(
              farmItem,
              farmItem.status ===
                'active'
                ? 'inactive'
                : 'active'
            )
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:bg-slate-50"
        >
          {farmItem.status ===
          'active'
            ? '⏸ Nonaktifkan'
            : '▶ Aktifkan'}
        </button>

        <button
          type="button"
          onClick={() =>
            onStatusChange(
              farmItem,
              'suspended'
            )
          }
          className="rounded-lg border border-amber-200 px-3 py-2 text-[10px] font-bold text-amber-600 transition hover:bg-amber-50"
        >
          ⚠ Suspend
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-red-200 px-3 py-2 text-[10px] font-bold text-red-600 transition hover:bg-red-50"
        >
          🗑 Hapus
        </button>

      </div>

    </div>
  )
}

// =====================================================
// MINI METRIC
// =====================================================

function MiniMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">

      <p className="truncate text-[9px] font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-xs font-black text-slate-800">
        {value}
      </p>

    </div>
  )
}

// =====================================================
// SMALL METRIC
// =====================================================

function SmallMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-2.5">

      <p className="text-[8px] font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-[10px] font-black text-slate-700">
        {value}
      </p>

    </div>
  )
}

// =====================================================
// FARM FORM
// =====================================================

function FarmForm({
  form,
  setForm,
}) {
  const update =
    (field) =>
    (event) => {
      setForm(
        (current) => ({
          ...current,
          [field]:
            event.target.value,
        })
      )
    }

  return (
    <div className="grid gap-5 md:grid-cols-2">

      <FormField
        label="Nama Peternakan"
        required
      >
        <input
          type="text"
          value={
            form.name
          }
          onChange={update(
            'name'
          )}
          placeholder="Contoh: Peternakan Makmur"
          className="form-input"
        />
      </FormField>

      <FormField label="Nama Pemilik">
        <input
          type="text"
          value={
            form.owner_name
          }
          onChange={update(
            'owner_name'
          )}
          placeholder="Nama pemilik"
          className="form-input"
        />
      </FormField>

      <FormField label="Nomor Telepon">
        <input
          type="text"
          value={
            form.phone
          }
          onChange={update(
            'phone'
          )}
          placeholder="08xxxxxxxxxx"
          className="form-input"
        />
      </FormField>

      <FormField label="Paket">
        <select
          value={
            form.package_name
          }
          onChange={update(
            'package_name'
          )}
          className="form-input"
        >
          <option value="Basic">
            Basic
          </option>
          <option value="Standard">
            Standard
          </option>
          <option value="Premium">
            Premium
          </option>
        </select>
      </FormField>

      <FormField label="Status">
        <select
          value={
            form.status
          }
          onChange={update(
            'status'
          )}
          className="form-input"
        >
          <option value="active">
            Aktif
          </option>
          <option value="inactive">
            Nonaktif
          </option>
          <option value="suspended">
            Ditangguhkan
          </option>
        </select>
      </FormField>

      <FormField
        label="Alamat"
        className="md:col-span-2"
      >
        <textarea
          value={
            form.address
          }
          onChange={update(
            'address'
          )}
          placeholder="Alamat peternakan"
          rows={4}
          className="form-input resize-none"
        />
      </FormField>

    </div>
  )
}

// =====================================================
// FORM FIELD
// =====================================================

function FormField({
  label,
  required = false,
  children,
  className = '',
}) {
  return (
    <div className={className}>

      <label className="mb-2 block text-xs font-bold text-slate-700">

        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}

      </label>

      {children}

    </div>
  )
}

// =====================================================
// FARM MODAL
// =====================================================

function FarmModal({
  editingFarm,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      title={
        editingFarm
          ? 'Edit Peternakan'
          : 'Tambah Peternakan'
      }
      onClose={
        onClose
      }
    >

      <form
        onSubmit={onSubmit}
      >

        <FarmForm
          form={form}
          setForm={setForm}
        />

        <div className="mt-6 flex justify-end gap-2">

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Menyimpan...'
              : editingFarm
              ? 'Simpan Perubahan'
              : 'Tambah Peternakan'}
          </button>

        </div>

      </form>

    </Modal>
  )
}

// =====================================================
// ADMIN MODAL
// =====================================================

function AdminModal({
  editingAdmin,
  form,
  setForm,
  farms,
  saving,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      title={
        editingAdmin
          ? 'Edit Admin Peternakan'
          : 'Tambah Admin Peternakan'
      }
      onClose={
        onClose
      }
    >

      <form
        onSubmit={onSubmit}
      >

        <div className="space-y-4">

          <FormField
            label="Nama Lengkap"
            required
          >
            <input
              type="text"
              value={
                form.full_name
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    full_name:
                      event.target.value,
                  })
                )
              }
              placeholder="Nama Admin Peternakan"
              className="form-input"
            />
          </FormField>

          <FormField
            label="Username"
            required
          >
            <input
              type="text"
              value={
                form.username
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    username:
                      event.target.value,
                  })
                )
              }
              placeholder="username"
              className="form-input"
            />
          </FormField>

          <FormField
            label={
              editingAdmin
                ? 'Password Baru'
                : 'Password'
            }
            required={
              !editingAdmin
            }
          >
            <input
              type="password"
              value={
                form.password
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    password:
                      event.target.value,
                  })
                )
              }
              placeholder={
                editingAdmin
                  ? 'Kosongkan jika tidak diubah'
                  : 'Password'
              }
              className="form-input"
            />
          </FormField>

          <FormField
            label="Peternakan"
            required
          >
            <select
              value={
                form.farm_id
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    farm_id:
                      event.target.value,
                  })
                )
              }
              className="form-input"
            >
              <option value="">
                Pilih Peternakan
              </option>

              {farms.map(
                (farmItem) => (
                  <option
                    key={
                      farmItem.id
                    }
                    value={
                      farmItem.id
                    }
                  >
                    {farmItem.farm_code
                      ? `${farmItem.farm_code} — `
                      : ''}
                    {farmItem.name}
                  </option>
                )
              )}

            </select>
          </FormField>

        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-3">

          <p className="text-[10px] font-bold text-slate-700">
            Hak Akses
          </p>

          <p className="mt-1 text-[10px] leading-5 text-slate-500">
            Akun ini akan menjadi Admin Peternakan dan dapat mengelola data operasional serta User pada peternakannya sendiri.
          </p>

        </div>

        <div className="mt-6 flex justify-end gap-2">

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Menyimpan...'
              : editingAdmin
              ? 'Simpan Perubahan'
              : 'Tambah Admin'}
          </button>

        </div>

      </form>

    </Modal>
  )
}

// =====================================================
// DETAIL FARM MODAL
// =====================================================

function FarmDetailModal({
  farmItem,
  admins,
  users,
  onClose,
  formatCurrency,
  formatNumber,
}) {
  return (
    <Modal
      title="Detail Peternakan"
      onClose={
        onClose
      }
      wide
    >

      <div className="space-y-5">

        <div className="rounded-2xl bg-slate-950 p-5 text-white">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600">
                🏠
              </div>

              <div>

                <h3 className="text-lg font-black">
                  {farmItem.name}
                </h3>

                <p className="text-xs text-slate-400">
                  {farmItem.farm_code ||
                    '-'}
                </p>

              </div>

            </div>

            <span
              className={`self-start rounded-full border px-3 py-1.5 text-[10px] font-bold ${getFarmStatusClass(
                farmItem.status
              )}`}
            >
              {getStatusLabel(
                farmItem.status
              )}
            </span>

          </div>

        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

          <DetailMetric
            label="Pemasukan"
            value={formatCurrency(
              farmItem.income
            )}
          />

          <DetailMetric
            label="Pengeluaran"
            value={formatCurrency(
              farmItem.expense
            )}
          />

          <DetailMetric
            label="Keuntungan"
            value={formatCurrency(
              farmItem.profit
            )}
          />

          <DetailMetric
            label="Populasi"
            value={`${formatNumber(
              farmItem.population
            )} ekor`}
          />

          <DetailMetric
            label="Produksi Telur"
            value={`${formatNumber(
              farmItem.eggProduction
            )} butir`}
          />

          <DetailMetric
            label="Kematian"
            value={`${formatNumber(
              farmItem.deaths
            )} ekor`}
          />

          <DetailMetric
            label="Admin"
            value={`${farmItem.adminCount} akun`}
          />

          <DetailMetric
            label="User"
            value={`${farmItem.userCount} akun`}
          />

        </div>

        <div className="grid gap-4 md:grid-cols-2">

          <div className="rounded-2xl border border-slate-200 p-4">

            <h4 className="font-bold text-slate-900">
              Informasi Peternakan
            </h4>

            <div className="mt-4 space-y-3">

              <DetailRow
                label="Pemilik"
                value={
                  farmItem.owner_name ||
                  '-'
                }
              />

              <DetailRow
                label="Telepon"
                value={
                  farmItem.phone ||
                  '-'
                }
              />

              <DetailRow
                label="Paket"
                value={
                  farmItem.package_name ||
                  'Basic'
                }
              />

              <DetailRow
                label="Alamat"
                value={
                  farmItem.address ||
                  '-'
                }
              />

            </div>

          </div>

          <div className="rounded-2xl border border-slate-200 p-4">

            <h4 className="font-bold text-slate-900">
              Akun Peternakan
            </h4>

            <div className="mt-4 space-y-3">

              {admins.length ===
              0 ? (
                <p className="text-xs text-slate-400">
                  Belum ada Admin Peternakan.
                </p>
              ) : (
                admins.map(
                  (admin) => (
                    <div
                      key={
                        admin.id
                      }
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                    >

                      <div>

                        <p className="text-xs font-bold text-slate-800">
                          {admin.full_name ||
                            admin.username}
                        </p>

                        <p className="text-[10px] text-slate-400">
                          @{admin.username}
                        </p>

                      </div>

                      <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-bold text-red-600">
                        Admin
                      </span>

                    </div>
                  )
                )
              )}

              <div className="rounded-xl bg-slate-50 p-3">

                <div className="flex items-center justify-between">

                  <span className="text-xs font-medium text-slate-600">
                    Total User
                  </span>

                  <span className="text-sm font-black text-slate-900">
                    {users.length}
                  </span>

                </div>

                <p className="mt-1 text-[10px] text-slate-400">
                  User dikelola langsung oleh Admin Peternakan.
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>

    </Modal>
  )
}

// =====================================================
// DETAIL METRIC
// =====================================================

function DetailMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">

      <p className="text-[9px] font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-slate-800">
        {value}
      </p>

    </div>
  )
}

// =====================================================
// DETAIL ROW
// =====================================================

function DetailRow({
  label,
  value,
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">

      <span className="shrink-0 text-[10px] font-medium text-slate-400">
        {label}
      </span>

      <span className="text-right text-xs font-bold text-slate-700">
        {value}
      </span>

    </div>
  )
}

// =====================================================
// INFO PANEL
// =====================================================

function InfoPanel({
  icon,
  title,
  text,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          {icon}
        </div>

        <div>

          <h3 className="text-sm font-bold text-slate-900">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {text}
          </p>

        </div>

      </div>

    </div>
  )
}

// =====================================================
// ALERT
// =====================================================

function Alert({
  type,
  message,
}) {
  const isError =
    type === 'error'

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isError
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >

      <div className="flex items-start gap-3">

        <span className="text-sm">
          {isError
            ? '⚠️'
            : '✓'}
        </span>

        <p className="text-xs font-semibold leading-5">
          {message}
        </p>

      </div>

    </div>
  )
}

// =====================================================
// LOADING
// =====================================================

function LoadingState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">

      <div className="text-center">

        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

        <p className="mt-4 text-xs font-medium text-slate-400">
          Memuat data peternakan...
        </p>

      </div>

    </div>
  )
}

// =====================================================
// EMPTY
// =====================================================

function EmptyState({
  icon,
  title,
  text,
  action,
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center">

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
        {icon}
      </div>

      <h3 className="mt-4 font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
        {text}
      </p>

      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}

    </div>
  )
}

// =====================================================
// MODAL
// =====================================================

function Modal({
  title,
  children,
  onClose,
  wide = false,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">

      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-2xl ${
          wide
            ? 'max-w-4xl'
            : 'max-w-xl'
        }`}
      >

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">

          <h2 className="font-black text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={
              onClose
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>

        </div>

        <div className="p-5 md:p-6">
          {children}
        </div>

      </div>

    </div>
  )
}

// =====================================================
// STATUS HELPERS
// =====================================================

function getStatusLabel(
  status
) {
  if (
    status === 'active'
  ) {
    return 'Aktif'
  }

  if (
    status === 'inactive'
  ) {
    return 'Nonaktif'
  }

  if (
    status === 'suspended'
  ) {
    return 'Ditangguhkan'
  }

  return status
}

function getFarmStatusClass(
  status
) {
  if (
    status === 'active'
  ) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  if (
    status === 'suspended'
  ) {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export default SuperAdmin