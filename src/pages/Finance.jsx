import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Finance({ user, farm }) {
  const [transactions, setTransactions] = useState([])
  const [chickenTypes, setChickenTypes] = useState([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterChickenType, setFilterChickenType] =
    useState('all')

  const [form, setForm] = useState({
    type: 'income',
    title: '',
    amount: '',
    chicken_type_id: '',
    transaction_date: new Date()
      .toISOString()
      .split('T')[0],
  })

  // =====================================================
  // FORMAT
  // =====================================================

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0)
  }

  const formatDate = (date) => {
    if (!date) return '-'

    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(date))
    } catch {
      return date
    }
  }

  // =====================================================
  // FARM FILTER
  // =====================================================

  const applyFarmFilter = (query) => {
    if (!user?.is_super_admin) {
      if (!farm?.farmId) {
        return null
      }

      return query.eq(
        'farm_id',
        farm.farmId
      )
    }

    return query
  }

  // =====================================================
  // LOAD DATA
  // =====================================================

  const loadData = async () => {
    if (!user) return

    setLoading(true)

    try {
      // -----------------------------------------------
      // TRANSACTIONS
      // -----------------------------------------------

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
        .order(
          'transaction_date',
          {
            ascending: false,
          }
        )

      const filteredTransactionQuery =
        applyFarmFilter(transactionQuery)

      if (!filteredTransactionQuery) {
        setTransactions([])
      } else {
        const {
          data,
          error,
        } = await filteredTransactionQuery

        if (error) {
          throw error
        }

        setTransactions(data || [])
      }

      // -----------------------------------------------
      // CHICKEN TYPES
      // -----------------------------------------------

      let chickenTypeQuery = supabase
        .from('chicken_types')
        .select(
          'id, name, description, farm_id, created_at'
        )
        .order('name', {
          ascending: true,
        })

      const filteredChickenTypeQuery =
        applyFarmFilter(
          chickenTypeQuery
        )

      if (!filteredChickenTypeQuery) {
        setChickenTypes([])
      } else {
        const {
          data,
          error,
        } =
          await filteredChickenTypeQuery

        if (error) {
          throw error
        }

        setChickenTypes(data || [])
      }
    } catch (error) {
      console.error(
        'Gagal mengambil data keuangan:',
        error
      )

      alert(
        `Gagal mengambil data keuangan: ${
          error.message || 'Terjadi kesalahan.'
        }`
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [
    user?.id,
    user?.is_super_admin,
    farm?.farmId,
  ])

  // =====================================================
  // FORM
  // =====================================================

  const resetForm = () => {
    setForm({
      type: 'income',
      title: '',
      amount: '',
      chicken_type_id: '',
      transaction_date: new Date()
        .toISOString()
        .split('T')[0],
    })

    setEditingTransaction(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (
    transaction
  ) => {
    setEditingTransaction(
      transaction
    )

    setForm({
      type:
        transaction.type ||
        'income',

      title:
        transaction.title ||
        '',

      amount:
        transaction.amount ??
        '',

      chicken_type_id:
        transaction.chicken_type_id ||
        '',

      transaction_date:
        transaction.transaction_date ||
        new Date()
          .toISOString()
          .split('T')[0],
    })

    setShowModal(true)
  }

  const closeModal = () => {
    if (saving) return

    setShowModal(false)
    resetForm()
  }

  const handleFormChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // =====================================================
  // SAVE
  // =====================================================

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault()

    if (!form.title.trim()) {
      alert(
        'Kategori atau keterangan transaksi wajib diisi.'
      )
      return
    }

    const amount =
      Number(form.amount)

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      alert(
        'Jumlah transaksi harus lebih dari 0.'
      )
      return
    }

    if (
      !form.transaction_date
    ) {
      alert(
        'Tanggal transaksi wajib diisi.'
      )
      return
    }

    if (
      !user?.is_super_admin &&
      !farm?.farmId
    ) {
      alert(
        'Akun ini belum terhubung ke farm.'
      )
      return
    }

    setSaving(true)

    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        amount,
        chicken_type_id:
          form.chicken_type_id ||
          null,
        transaction_date:
          form.transaction_date,
      }

      // =================================================
      // UPDATE
      // =================================================

      if (editingTransaction) {
        let updateQuery = supabase
          .from('transactions')
          .update(payload)
          .eq(
            'id',
            editingTransaction.id
          )

        if (!user.is_super_admin) {
          updateQuery =
            updateQuery.eq(
              'farm_id',
              farm.farmId
            )
        }

        const {
          error,
        } = await updateQuery

        if (error) {
          throw error
        }

        alert(
          'Transaksi berhasil diperbarui.'
        )
      }

      // =================================================
      // INSERT
      // =================================================

      else {
        const insertPayload = {
          ...payload,

          /*
           * Untuk admin/user:
           * farm_id wajib farm mereka.
           *
           * Untuk super admin:
           * tetap menggunakan farm_id akun jika tersedia,
           * supaya transaksi tidak menjadi orphan.
           */
          farm_id:
            farm?.farmId ||
            user?.farm_id ||
            null,
        }

        if (
          !insertPayload.farm_id
        ) {
          alert(
            'Farm tujuan transaksi belum ditentukan.'
          )
          return
        }

        const {
          error,
        } = await supabase
          .from('transactions')
          .insert(
            insertPayload
          )

        if (error) {
          throw error
        }

        alert(
          'Transaksi berhasil ditambahkan.'
        )
      }

      closeModal()
      await loadData()
    } catch (error) {
      console.error(
        'Gagal menyimpan transaksi:',
        error
      )

      alert(
        `Gagal menyimpan transaksi: ${
          error.message ||
          'Terjadi kesalahan.'
        }`
      )
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (
    transaction
  ) => {
    const confirmed =
      window.confirm(
        `Hapus transaksi "${transaction.title}" sebesar ${formatCurrency(
          transaction.amount
        )}?`
      )

    if (!confirmed) {
      return
    }

    try {
      let deleteQuery =
        supabase
          .from('transactions')
          .delete()
          .eq(
            'id',
            transaction.id
          )

      if (!user.is_super_admin) {
        deleteQuery =
          deleteQuery.eq(
            'farm_id',
            farm.farmId
          )
      }

      const {
        error,
      } = await deleteQuery

      if (error) {
        throw error
      }

      alert(
        'Transaksi berhasil dihapus.'
      )

      await loadData()
    } catch (error) {
      console.error(
        'Gagal menghapus transaksi:',
        error
      )

      alert(
        `Gagal menghapus transaksi: ${
          error.message ||
          'Terjadi kesalahan.'
        }`
      )
    }
  }

  // =====================================================
  // FILTER
  // =====================================================

  const filteredTransactions =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase()

      return transactions.filter(
        (transaction) => {
          const matchesSearch =
            !keyword ||
            String(
              transaction.title ||
                ''
            )
              .toLowerCase()
              .includes(keyword) ||
            String(
              transaction
                .chicken_types
                ?.name || ''
            )
              .toLowerCase()
              .includes(keyword)

          const matchesType =
            filterType === 'all' ||
            transaction.type ===
              filterType

          const matchesChickenType =
            filterChickenType ===
              'all' ||
            transaction.chicken_type_id ===
              filterChickenType

          return (
            matchesSearch &&
            matchesType &&
            matchesChickenType
          )
        }
      )
    }, [
      transactions,
      search,
      filterType,
      filterChickenType,
    ])

  // =====================================================
  // SUMMARY
  // =====================================================

  const summary = useMemo(() => {
    let income = 0
    let expense = 0

    transactions.forEach(
      (transaction) => {
        const amount =
          Number(
            transaction.amount
          ) || 0

        if (
          transaction.type ===
          'income'
        ) {
          income += amount
        }

        if (
          transaction.type ===
          'expense'
        ) {
          expense += amount
        }
      }
    )

    return {
      income,
      expense,
      profit:
        income - expense,
      total:
        transactions.length,
    }
  }, [transactions])

  // =====================================================
  // PER CHICKEN TYPE
  // =====================================================

  const chickenTypeSummary =
    useMemo(() => {
      const result = {}

      transactions.forEach(
        (transaction) => {
          const typeId =
            transaction.chicken_type_id ||
            'without-type'

          const typeName =
            transaction
              .chicken_types
              ?.name ||
            'Tanpa Jenis Ayam'

          if (!result[typeId]) {
            result[typeId] = {
              id: typeId,
              name: typeName,
              income: 0,
              expense: 0,
            }
          }

          const amount =
            Number(
              transaction.amount
            ) || 0

          if (
            transaction.type ===
            'income'
          ) {
            result[typeId].income +=
              amount
          }

          if (
            transaction.type ===
            'expense'
          ) {
            result[typeId].expense +=
              amount
          }
        }
      )

      return Object.values(
        result
      ).sort(
        (a, b) =>
          b.income -
            b.expense -
            (a.income -
              a.expense)
      )
    }, [transactions])

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* HEADER */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-red-600">
              Keuangan
            </span>

            {user?.is_super_admin ? (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold text-white">
                SEMUA FARM
              </span>
            ) : (
              farm?.farmCode && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">
                  {farm.farmCode}
                </span>
              )
            )}
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Keuangan
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Kelola pemasukan dan pengeluaran
            peternakan.
          </p>
        </div>

        <button
          type="button"
          onClick={
            openAddModal
          }
          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98]"
        >
          + Tambah Transaksi
        </button>
      </section>

      {/* SUMMARY */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          title="Pemasukan"
          value={formatCurrency(
            summary.income
          )}
          icon="💰"
          accent="green"
        />

        <SummaryCard
          title="Pengeluaran"
          value={formatCurrency(
            summary.expense
          )}
          icon="💸"
          accent="red"
        />

        <SummaryCard
          title="Keuntungan"
          value={formatCurrency(
            summary.profit
          )}
          icon="📈"
          accent={
            summary.profit >= 0
              ? 'green'
              : 'red'
          }
        />

        <SummaryCard
          title="Total Transaksi"
          value={summary.total.toLocaleString(
            'id-ID'
          )}
          icon="🧾"
          accent="blue"
        />
      </section>

      {/* FILTER */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

          <div className="relative xl:col-span-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Cari transaksi atau jenis ayam..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
            />
          </div>

          <select
            value={filterType}
            onChange={(event) =>
              setFilterType(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-red-500 focus:bg-white"
          >
            <option value="all">
              Semua Transaksi
            </option>

            <option value="income">
              Pemasukan
            </option>

            <option value="expense">
              Pengeluaran
            </option>
          </select>

          <select
            value={
              filterChickenType
            }
            onChange={(event) =>
              setFilterChickenType(
                event.target.value
              )
            }
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-red-500 focus:bg-white"
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
      </section>

      {/* TYPE SUMMARY */}
      {chickenTypeSummary.length >
        0 && (
        <section>
          <div className="mb-4">
            <h2 className="font-bold text-slate-900">
              Ringkasan per Jenis Ayam
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Perbandingan pemasukan dan
              pengeluaran berdasarkan jenis
              ayam.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {chickenTypeSummary.map(
              (item) => {
                const profit =
                  item.income -
                  item.expense

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                          🐔
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-slate-900">
                            {item.name}
                          </h3>

                          <p className="text-[10px] text-slate-400">
                            Ringkasan keuangan
                          </p>
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                          profit >= 0
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {profit >=
                        0
                          ? 'Profit'
                          : 'Minus'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <MiniAmount
                        label="Masuk"
                        value={formatCurrency(
                          item.income
                        )}
                      />

                      <MiniAmount
                        label="Keluar"
                        value={formatCurrency(
                          item.expense
                        )}
                      />

                      <MiniAmount
                        label="Selisih"
                        value={formatCurrency(
                          profit
                        )}
                      />
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </section>
      )}

      {/* TRANSACTION TABLE */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">
              Daftar Transaksi
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {filteredTransactions.length.toLocaleString(
                'id-ID'
              )}{' '}
              transaksi ditampilkan.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadData
            }
            disabled={loading}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <LoadingState />
        ) : filteredTransactions.length ===
          0 ? (
          <EmptyState
            onAdd={
              openAddModal
            }
          />
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Tanggal
                    </th>

                    {user?.is_super_admin && (
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Farm
                      </th>
                    )}

                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Keterangan
                    </th>

                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Jenis Ayam
                    </th>

                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Tipe
                    </th>

                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Jumlah
                    </th>

                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map(
                    (transaction) => (
                      <TransactionRow
                        key={
                          transaction.id
                        }
                        transaction={
                          transaction
                        }
                        isSuperAdmin={
                          user?.is_super_admin
                        }
                        formatCurrency={
                          formatCurrency
                        }
                        formatDate={
                          formatDate
                        }
                        onEdit={
                          openEditModal
                        }
                        onDelete={
                          handleDelete
                        }
                      />
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="space-y-3 p-3 md:hidden">
              {filteredTransactions.map(
                (transaction) => (
                  <MobileTransactionCard
                    key={
                      transaction.id
                    }
                    transaction={
                      transaction
                    }
                    isSuperAdmin={
                      user?.is_super_admin
                    }
                    formatCurrency={
                      formatCurrency
                    }
                    formatDate={
                      formatDate
                    }
                    onEdit={
                      openEditModal
                    }
                    onDelete={
                      handleDelete
                    }
                  />
                )
              )}
            </div>
          </>
        )}
      </section>

      {/* MODAL */}
      {showModal && (
        <TransactionModal
          form={form}
          editingTransaction={
            editingTransaction
          }
          chickenTypes={
            chickenTypes
          }
          saving={saving}
          onChange={
            handleFormChange
          }
          onSubmit={
            handleSubmit
          }
          onClose={
            closeModal
          }
        />
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
  accent,
}) {
  const accentClasses = {
    green: 'bg-emerald-50',
    red: 'bg-red-50',
    blue: 'bg-blue-50',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          accentClasses[accent] ||
          'bg-slate-100'
        }`}
      >
        {icon}
      </div>

      <p className="mt-3 text-xs font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-1 truncate text-base font-black text-slate-900 md:text-lg">
        {value}
      </p>
    </div>
  )
}

// =====================================================
// MINI AMOUNT
// =====================================================

function MiniAmount({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <p className="text-[9px] text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-[10px] font-bold text-slate-700">
        {value}
      </p>
    </div>
  )
}

// =====================================================
// TRANSACTION ROW
// =====================================================

function TransactionRow({
  transaction,
  isSuperAdmin,
  formatCurrency,
  formatDate,
  onEdit,
  onDelete,
}) {
  const isIncome =
    transaction.type ===
    'income'

  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50/70">

      <td className="px-4 py-4 text-xs text-slate-500">
        {formatDate(
          transaction.transaction_date
        )}
      </td>

      {isSuperAdmin && (
        <td className="px-4 py-4">
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
            {transaction.farm_id
              ? transaction.farm_id.slice(
                  0,
                  8
                )
              : '-'}
          </span>
        </td>
      )}

      <td className="px-4 py-4">
        <p className="max-w-[220px] truncate text-sm font-semibold text-slate-800">
          {transaction.title ||
            '-'}
        </p>
      </td>

      <td className="px-4 py-4">
        {transaction
          .chicken_types
          ?.name ? (
          <span className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[10px] font-semibold text-red-600">
            🐔{' '}
            {
              transaction
                .chicken_types
                .name
            }
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            Semua / tidak ditentukan
          </span>
        )}
      </td>

      <td className="px-4 py-4">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            isIncome
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {isIncome
            ? 'Pemasukan'
            : 'Pengeluaran'}
        </span>
      </td>

      <td
        className={`px-4 py-4 text-right text-sm font-black ${
          isIncome
            ? 'text-emerald-600'
            : 'text-red-600'
        }`}
      >
        {isIncome
          ? '+ '
          : '- '}
        {formatCurrency(
          transaction.amount
        )}
      </td>

      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() =>
              onEdit(
                transaction
              )
            }
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() =>
              onDelete(
                transaction
              )
            }
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            Hapus
          </button>
        </div>
      </td>
    </tr>
  )
}

// =====================================================
// MOBILE CARD
// =====================================================

function MobileTransactionCard({
  transaction,
  isSuperAdmin,
  formatCurrency,
  formatDate,
  onEdit,
  onDelete,
}) {
  const isIncome =
    transaction.type ===
    'income'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            {transaction.title ||
              '-'}
          </p>

          <p className="mt-1 text-[11px] text-slate-400">
            {formatDate(
              transaction.transaction_date
            )}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${
            isIncome
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {isIncome
            ? 'Pemasukan'
            : 'Pengeluaran'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[9px] text-slate-400">
            Jenis Ayam
          </p>

          <p className="mt-1 truncate text-xs font-bold text-slate-700">
            {transaction
              .chicken_types
              ?.name ||
              'Tidak ditentukan'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[9px] text-slate-400">
            Jumlah
          </p>

          <p
            className={`mt-1 truncate text-xs font-black ${
              isIncome
                ? 'text-emerald-600'
                : 'text-red-600'
            }`}
          >
            {formatCurrency(
              transaction.amount
            )}
          </p>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="mt-2 rounded-xl bg-slate-50 p-3">
          <p className="text-[9px] text-slate-400">
            Farm ID
          </p>

          <p className="mt-1 truncate font-mono text-[10px] text-slate-600">
            {transaction.farm_id ||
              '-'}
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() =>
            onEdit(
              transaction
            )
          }
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={() =>
            onDelete(
              transaction
            )
          }
          className="flex-1 rounded-xl border border-red-100 bg-red-50 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-100"
        >
          Hapus
        </button>
      </div>
    </div>
  )
}

// =====================================================
// MODAL
// =====================================================

function TransactionModal({
  form,
  editingTransaction,
  chickenTypes,
  saving,
  onChange,
  onSubmit,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">

        {/* HEADER */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {editingTransaction
                ? 'Edit Transaksi'
                : 'Tambah Transaksi'}
            </h2>

            <p className="mt-0.5 text-xs text-slate-400">
              Masukkan data transaksi
              peternakan.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* FORM */}
        <form
          onSubmit={onSubmit}
          className="space-y-5 p-5"
        >

          {/* TYPE */}
          <div>
            <label className="mb-2 block text-xs font-bold text-slate-700">
              Tipe Transaksi
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onChange({
                    target: {
                      name: 'type',
                      value:
                        'income',
                    },
                  })
                }
                className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                  form.type ===
                  'income'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                💰 Pemasukan
              </button>

              <button
                type="button"
                onClick={() =>
                  onChange({
                    target: {
                      name: 'type',
                      value:
                        'expense',
                    },
                  })
                }
                className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                  form.type ===
                  'expense'
                    ? 'border-red-500 bg-red-50 text-red-600'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                💸 Pengeluaran
              </button>
            </div>
          </div>

          {/* TITLE */}
          <div>
            <label
              htmlFor="transaction-title"
              className="mb-2 block text-xs font-bold text-slate-700"
            >
              Kategori / Keterangan
            </label>

            <input
              id="transaction-title"
              name="title"
              type="text"
              value={form.title}
              onChange={onChange}
              placeholder={
                form.type ===
                'income'
                  ? 'Contoh: Jual Telur'
                  : 'Contoh: Pembelian Pakan'
              }
              disabled={saving}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:opacity-60"
            />
          </div>

          {/* AMOUNT */}
          <div>
            <label
              htmlFor="transaction-amount"
              className="mb-2 block text-xs font-bold text-slate-700"
            >
              Jumlah
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                Rp
              </span>

              <input
                id="transaction-amount"
                name="amount"
                type="number"
                min="0"
                step="1"
                value={
                  form.amount
                }
                onChange={onChange}
                placeholder="0"
                disabled={saving}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:opacity-60"
              />
            </div>
          </div>

          {/* CHICKEN TYPE */}
          <div>
            <label
              htmlFor="transaction-chicken-type"
              className="mb-2 block text-xs font-bold text-slate-700"
            >
              Jenis Ayam
            </label>

            <select
              id="transaction-chicken-type"
              name="chicken_type_id"
              value={
                form.chicken_type_id
              }
              onChange={onChange}
              disabled={saving}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:opacity-60"
            >
              <option value="">
                Tidak ditentukan
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

          {/* DATE */}
          <div>
            <label
              htmlFor="transaction-date"
              className="mb-2 block text-xs font-bold text-slate-700"
            >
              Tanggal Transaksi
            </label>

            <input
              id="transaction-date"
              name="transaction_date"
              type="date"
              value={
                form.transaction_date
              }
              onChange={onChange}
              disabled={saving}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:opacity-60"
            />
          </div>

          {/* BUTTON */}
          <div className="flex gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? 'Menyimpan...'
                : editingTransaction
                ? 'Simpan Perubahan'
                : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =====================================================
// LOADING
// =====================================================

function LoadingState() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center p-8">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />

      <p className="mt-4 text-sm font-semibold text-slate-600">
        Memuat data keuangan...
      </p>
    </div>
  )
}

// =====================================================
// EMPTY
// =====================================================

function EmptyState({
  onAdd,
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        🧾
      </div>

      <h3 className="mt-4 font-bold text-slate-900">
        Belum ada transaksi
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
        Tambahkan pemasukan atau
        pengeluaran untuk mulai mencatat
        keuangan peternakan.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-5 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700"
      >
        + Tambah Transaksi
      </button>
    </div>
  )
}

export default Finance