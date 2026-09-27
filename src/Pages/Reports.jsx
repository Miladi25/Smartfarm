import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

function Reports({ user }) {
  const today = new Date().toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1)
    return date.toISOString().split('T')[0]
  })

  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')
  const [data, setData] = useState({
    transactions: [],
    debts: [],
    receivables: [],
    population: [],
    production: [],
    deaths: [],
    feed: [],
    inventory: [],
  })

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0)
  }

  const formatNumber = (value) => {
    return new Intl.NumberFormat('id-ID').format(Number(value) || 0)
  }

  const formatDate = (value) => {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return '-'

    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const loadReports = async () => {
    setLoading(true)
    setError('')

    try {
      const [
        transactionsRes,
        debtsRes,
        receivablesRes,
        populationRes,
        productionRes,
        deathsRes,
        feedRes,
        inventoryRes,
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate)
          .order('transaction_date', { ascending: false }),

        supabase
          .from('debts')
          .select('*')
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .order('created_at', { ascending: false }),

        supabase
          .from('receivables')
          .select('*')
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .order('created_at', { ascending: false }),

        supabase
          .from('chicken_population')
          .select('*')
          .gte('record_date', startDate)
          .lte('record_date', endDate)
          .order('record_date', { ascending: false }),

        supabase
          .from('egg_production')
          .select('*')
          .gte('record_date', startDate)
          .lte('record_date', endDate)
          .order('record_date', { ascending: false }),

        supabase
          .from('chicken_deaths')
          .select('*')
          .gte('record_date', startDate)
          .lte('record_date', endDate)
          .order('record_date', { ascending: false }),

        supabase
          .from('feed_stock')
          .select('*')
          .gte('record_date', startDate)
          .lte('record_date', endDate)
          .order('record_date', { ascending: false }),

        supabase
          .from('inventory')
          .select('*')
          .gte('record_date', startDate)
          .lte('record_date', endDate)
          .order('record_date', { ascending: false }),
      ])

      const responses = [
        transactionsRes,
        debtsRes,
        receivablesRes,
        populationRes,
        productionRes,
        deathsRes,
        feedRes,
        inventoryRes,
      ]

      const failed = responses.find((response) => response.error)

      if (failed?.error) {
        throw new Error(failed.error.message)
      }

      setData({
        transactions: transactionsRes.data || [],
        debts: debtsRes.data || [],
        receivables: receivablesRes.data || [],
        population: populationRes.data || [],
        production: productionRes.data || [],
        deaths: deathsRes.data || [],
        feed: feedRes.data || [],
        inventory: inventoryRes.data || [],
      })
    } catch (err) {
      console.error('Gagal memuat laporan:', err)
      setError(err.message || 'Gagal memuat data laporan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const summary = useMemo(() => {
    const income = data.transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const expense = data.transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const profit = income - expense

    const debt = data.debts.reduce((sum, item) => {
      const amount = Number(item.amount || 0)
      const paid = Number(item.paid_amount || 0)

      return sum + Math.max(amount - paid, 0)
    }, 0)

    const receivable = data.receivables.reduce((sum, item) => {
      const amount = Number(item.amount || 0)
      const received = Number(item.received_amount || 0)

      return sum + Math.max(amount - received, 0)
    }, 0)

    const eggs = data.production.reduce(
      (sum, item) => sum + Number(item.total_eggs || 0),
      0
    )

    const goodEggs = data.production.reduce(
      (sum, item) => sum + Number(item.good_eggs || 0),
      0
    )

    const brokenEggs = data.production.reduce(
      (sum, item) => sum + Number(item.broken_eggs || 0),
      0
    )

    const rejectedEggs = data.production.reduce(
      (sum, item) => sum + Number(item.rejected_eggs || 0),
      0
    )

    const deaths = data.deaths.reduce(
      (sum, item) => sum + Number(item.deaths || 0),
      0
    )

    const latestPopulation = data.population[0]

    const population = latestPopulation
      ? Math.max(
          Number(latestPopulation.initial_population || 0) +
            Number(latestPopulation.incoming || 0) -
            Number(latestPopulation.outgoing || 0) -
            Number(latestPopulation.deaths || 0),
          0
        )
      : 0

    const quality = eggs > 0 ? (goodEggs / eggs) * 100 : 0

    return {
      income,
      expense,
      profit,
      debt,
      receivable,
      eggs,
      goodEggs,
      brokenEggs,
      rejectedEggs,
      deaths,
      population,
      quality,
    }
  }, [data])

  const transactionRows = useMemo(() => {
    return data.transactions.map((item) => ({
      Tanggal: formatDate(item.transaction_date),
      Jenis: item.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      Judul: item.title || '-',
      Deskripsi: item.description || '-',
      Jumlah: Number(item.amount || 0),
    }))
  }, [data.transactions])

  const reportRows = useMemo(() => {
    return [
      {
        Kategori: 'Pemasukan',
        Nilai: summary.income,
      },
      {
        Kategori: 'Pengeluaran',
        Nilai: summary.expense,
      },
      {
        Kategori: 'Keuntungan Bersih',
        Nilai: summary.profit,
      },
      {
        Kategori: 'Hutang Berjalan',
        Nilai: summary.debt,
      },
      {
        Kategori: 'Piutang Berjalan',
        Nilai: summary.receivable,
      },
      {
        Kategori: 'Produksi Telur',
        Nilai: summary.eggs,
      },
      {
        Kategori: 'Telur Baik',
        Nilai: summary.goodEggs,
      },
      {
        Kategori: 'Telur Pecah',
        Nilai: summary.brokenEggs,
      },
      {
        Kategori: 'Telur Reject',
        Nilai: summary.rejectedEggs,
      },
      {
        Kategori: 'Kematian Ayam',
        Nilai: summary.deaths,
      },
      {
        Kategori: 'Populasi Ayam',
        Nilai: summary.population,
      },
      {
        Kategori: 'Kualitas Telur',
        Nilai: `${summary.quality.toFixed(1)}%`,
      },
    ]
  }, [summary])

  const setPreset = (preset) => {
    const end = new Date()
    const start = new Date()

    if (preset === 'today') {
      setStartDate(today)
      setEndDate(today)
      return
    }

    if (preset === '7') {
      start.setDate(end.getDate() - 6)
    }

    if (preset === '30') {
      start.setDate(end.getDate() - 29)
    }

    if (preset === 'month') {
      start.setDate(1)
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const exportExcel = () => {
    setExporting('excel')

    try {
      const workbook = XLSX.utils.book_new()

      const summarySheet = XLSX.utils.json_to_sheet(reportRows)

      const transactionSheet = XLSX.utils.json_to_sheet(transactionRows)

      const productionSheet = XLSX.utils.json_to_sheet(
        data.production.map((item) => ({
          Tanggal: formatDate(item.record_date),
          'Total Telur': Number(item.total_eggs || 0),
          'Telur Baik': Number(item.good_eggs || 0),
          'Telur Pecah': Number(item.broken_eggs || 0),
          'Telur Reject': Number(item.rejected_eggs || 0),
          Catatan: item.notes || '-',
        }))
      )

      const deathSheet = XLSX.utils.json_to_sheet(
        data.deaths.map((item) => ({
          Tanggal: formatDate(item.record_date),
          Kematian: Number(item.deaths || 0),
          Penyebab: item.cause || '-',
          Catatan: item.notes || '-',
        }))
      )

      const populationSheet = XLSX.utils.json_to_sheet(
        data.population.map((item) => ({
          Tanggal: formatDate(item.record_date),
          'Populasi Awal': Number(item.initial_population || 0),
          Masuk: Number(item.incoming || 0),
          Keluar: Number(item.outgoing || 0),
          Kematian: Number(item.deaths || 0),
          'Populasi Akhir':
            Number(item.initial_population || 0) +
            Number(item.incoming || 0) -
            Number(item.outgoing || 0) -
            Number(item.deaths || 0),
          Catatan: item.notes || '-',
        }))
      )

      const feedSheet = XLSX.utils.json_to_sheet(
        data.feed.map((item) => ({
          Tanggal: formatDate(item.record_date),
          Pakan: item.feed_name || '-',
          Jenis: item.feed_type || '-',
          Jumlah: Number(item.quantity || 0),
          Satuan: item.unit || '-',
          'Minimum Stok': Number(item.minimum_stock || 0),
          Catatan: item.notes || '-',
        }))
      )

      const inventorySheet = XLSX.utils.json_to_sheet(
        data.inventory.map((item) => ({
          Tanggal: formatDate(item.record_date),
          Barang: item.item_name || '-',
          Jenis: item.item_type || '-',
          Jumlah: Number(item.quantity || 0),
          Satuan: item.unit || '-',
          'Minimum Stok': Number(item.minimum_stock || 0),
          Catatan: item.notes || '-',
        }))
      )

      const debtSheet = XLSX.utils.json_to_sheet(
        data.debts.map((item) => ({
          Judul: item.title || '-',
          Jumlah: Number(item.amount || 0),
          Dibayar: Number(item.paid_amount || 0),
          Sisa:
            Math.max(
              Number(item.amount || 0) - Number(item.paid_amount || 0),
              0
            ),
          JatuhTempo: formatDate(item.due_date),
          Status: item.status || '-',
        }))
      )

      const receivableSheet = XLSX.utils.json_to_sheet(
        data.receivables.map((item) => ({
          Judul: item.title || '-',
          Jumlah: Number(item.amount || 0),
          Diterima: Number(item.received_amount || 0),
          Sisa:
            Math.max(
              Number(item.amount || 0) -
                Number(item.received_amount || 0),
              0
            ),
          JatuhTempo: formatDate(item.due_date),
          Status: item.status || '-',
        }))
      )

      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan')
      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transaksi')
      XLSX.utils.book_append_sheet(workbook, productionSheet, 'Produksi Telur')
      XLSX.utils.book_append_sheet(workbook, deathSheet, 'Kematian')
      XLSX.utils.book_append_sheet(workbook, populationSheet, 'Populasi')
      XLSX.utils.book_append_sheet(workbook, feedSheet, 'Stok Pakan')
      XLSX.utils.book_append_sheet(workbook, inventorySheet, 'Stok Barang')
      XLSX.utils.book_append_sheet(workbook, debtSheet, 'Hutang')
      XLSX.utils.book_append_sheet(
        workbook,
        receivableSheet,
        'Piutang'
      )

      const filename = `DB-Farm-Laporan-${startDate}-${endDate}.xlsx`

      XLSX.writeFile(workbook, filename)
    } catch (err) {
      console.error('Gagal export Excel:', err)
      setError('Gagal membuat file Excel.')
    } finally {
      setExporting('')
    }
  }

  const exportPDF = () => {
    setExporting('pdf')

    try {
      const doc = new jsPDF()

      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('Smart Farm', 14, 18)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Laporan Peternakan Digital', 14, 26)

      doc.setFontSize(10)
      doc.text(
        `Periode: ${formatDate(startDate)} - ${formatDate(endDate)}`,
        14,
        34
      )

      doc.text(
        `Dibuat: ${formatDate(new Date())}`,
        14,
        40
      )

      autoTable(doc, {
        startY: 48,
        head: [['Kategori', 'Nilai']],
        body: reportRows.map((row) => [
          row.Kategori,
          typeof row.Nilai === 'number'
            ? row.Kategori.includes('Telur') ||
              row.Kategori.includes('Ayam') ||
              row.Kategori.includes('Kematian') ||
              row.Kategori.includes('Populasi')
              ? formatNumber(row.Nilai)
              : formatCurrency(row.Nilai)
            : row.Nilai,
        ]),
        styles: {
          fontSize: 9,
        },
        headStyles: {
          fontStyle: 'bold',
        },
      })

      let currentY = doc.lastAutoTable.finalY + 12

      if (transactionRows.length > 0) {
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Detail Transaksi', 14, currentY)

        currentY += 6

        autoTable(doc, {
          startY: currentY,
          head: [['Tanggal', 'Jenis', 'Judul', 'Jumlah']],
          body: transactionRows.map((row) => [
            row.Tanggal,
            row.Jenis,
            row.Judul,
            formatCurrency(row.Jumlah),
          ]),
          styles: {
            fontSize: 8,
          },
          headStyles: {
            fontStyle: 'bold',
          },
        })
      }

      const pages = doc.internal.getNumberOfPages()

      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(
          '© 2026 Smart Farm — Developed by Miladi — IT Developer',
          14,
          290
        )
      }

      const filename = `DB-Farm-Laporan-${startDate}-${endDate}.pdf`

      doc.save(filename)
    } catch (err) {
      console.error('Gagal export PDF:', err)
      setError('Gagal membuat file PDF.')
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-red-600 via-red-500 to-red-700 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                Peternakan Digital
              </div>

              <h1 className="text-2xl font-black md:text-3xl">
                Laporan Smart Farm
              </h1>

              <p className="mt-2 max-w-2xl text-sm text-red-50">
                Buat laporan keuangan dan operasional peternakan berdasarkan
                periode yang kamu pilih.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-xs text-red-100">Periode laporan</p>
              <p className="mt-1 font-bold">
                {formatDate(startDate)} — {formatDate(endDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Filter Laporan
              </h2>
              <p className="text-sm text-slate-500">
                Tentukan periode data yang ingin dimasukkan ke laporan.
              </p>
            </div>

            <button
              onClick={loadReports}
              disabled={loading}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Memuat...' : '↻ Refresh Data'}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Tanggal Mulai
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-red-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-700">
                Tanggal Akhir
              </label>

              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-red-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-end gap-2 lg:col-span-2">
              <button
                onClick={() => setPreset('today')}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:bg-red-50"
              >
                Hari Ini
              </button>

              <button
                onClick={() => setPreset('7')}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:bg-red-50"
              >
                7 Hari
              </button>

              <button
                onClick={() => setPreset('30')}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:bg-red-50"
              >
                30 Hari
              </button>

              <button
                onClick={() => setPreset('month')}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:bg-red-50"
              >
                Bulan Ini
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Total Pemasukan
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-600">
              {formatCurrency(summary.income)}
            </p>
          </div>

          <div className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Total Pengeluaran
            </p>
            <p className="mt-2 text-2xl font-black text-red-600">
              {formatCurrency(summary.expense)}
            </p>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Keuntungan Bersih
            </p>
            <p
              className={`mt-2 text-2xl font-black ${
                summary.profit >= 0
                  ? 'text-blue-600'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(summary.profit)}
            </p>
          </div>

          <div className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Populasi Ayam
            </p>
            <p className="mt-2 text-2xl font-black text-orange-600">
              {formatNumber(summary.population)}
            </p>
            <p className="mt-1 text-xs text-slate-400">ekor</p>
          </div>
        </div>

        {/* Operational summary */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-sm font-semibold text-slate-500">
              Produksi Telur
            </p>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {formatNumber(summary.eggs)}
            </p>
            <p className="mt-1 text-xs text-slate-400">butir</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-sm font-semibold text-slate-500">
              Kualitas Telur
            </p>
            <p className="mt-2 text-2xl font-black text-emerald-600">
              {summary.quality.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {formatNumber(summary.goodEggs)} telur baik
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-sm font-semibold text-slate-500">
              Kematian Ayam
            </p>
            <p className="mt-2 text-2xl font-black text-red-600">
              {formatNumber(summary.deaths)}
            </p>
            <p className="mt-1 text-xs text-slate-400">ekor</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <p className="text-sm font-semibold text-slate-500">
              Hutang + Piutang
            </p>
            <p className="mt-2 text-xl font-black text-slate-900">
              {formatCurrency(summary.debt + summary.receivable)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Berjalan saat ini
            </p>
          </div>
        </div>

        {/* Export */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Export Laporan
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Simpan laporan periode terpilih sebagai PDF atau Excel.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={exportPDF}
                disabled={exporting !== ''}
                className="rounded-2xl bg-red-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting === 'pdf'
                  ? 'Membuat PDF...'
                  : '📄 Export PDF'}
              </button>

              <button
                onClick={exportExcel}
                disabled={exporting !== ''}
                className="rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting === 'excel'
                  ? 'Membuat Excel...'
                  : '📊 Export Excel'}
              </button>
            </div>
          </div>
        </div>

        {/* Transaction preview */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Preview Transaksi
              </h2>
              <p className="text-sm text-slate-500">
                {transactionRows.length} transaksi dalam periode laporan.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Tanggal
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Jenis
                  </th>
                  <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">
                    Judul
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500">
                    Jumlah
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {transactionRows.slice(0, 10).map((row, index) => (
                  <tr key={`${row.Tanggal}-${row.Judul}-${index}`}>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {row.Tanggal}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          row.Jenis === 'Pemasukan'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {row.Jenis}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm font-bold text-slate-800">
                      {row.Judul}
                    </td>

                    <td
                      className={`px-5 py-4 text-right text-sm font-black ${
                        row.Jenis === 'Pemasukan'
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(row.Jumlah)}
                    </td>
                  </tr>
                ))}

                {transactionRows.length === 0 && (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      Tidak ada transaksi pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="pb-6 text-center text-xs text-slate-400">
          <p>© 2026 Smart Farm</p>
          <p className="mt-1">
            Developed by Miladi — IT Developer
          </p>
        </div>
      </div>
    </div>
  )
}

export default Reports