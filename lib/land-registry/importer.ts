import { createAdminClient } from '@/lib/supabase/admin'
import { fetchLandRegistryCsvStream } from './downloader'
import { parseLandRegistryCsvStream, buildAddressLine } from './parser'
import { geocodeTransactionsForMonth } from '@/lib/geocoding/postcodes-io'
import type { PropertyTransaction } from '@/types/land-registry'

const BATCH_SIZE = 500

interface ImportResult {
  rowsDownloaded: number
  rowsInserted: number
  rowsSkipped: number
  rowsDeleted: number
  rowsGeocoded: number
}

interface DbRow {
  transaction_id: string
  price: number
  date_of_transfer: string
  postcode: string
  property_type: string
  is_new_build: boolean
  tenure: string
  paon: string | null
  saon: string | null
  street: string | null
  locality: string | null
  town: string | null
  district: string | null
  county: string | null
  address_line: string
  import_month: string
}

function toDbRow(tx: PropertyTransaction, importMonth: string): DbRow {
  return {
    transaction_id: tx.transactionId,
    price: tx.price,
    date_of_transfer: tx.dateOfTransfer,
    postcode: tx.postcode,
    property_type: tx.propertyType,
    is_new_build: tx.isNewBuild,
    tenure: tx.tenure,
    paon: tx.paon,
    saon: tx.saon,
    street: tx.street,
    locality: tx.locality,
    town: tx.town,
    district: tx.district,
    county: tx.county,
    address_line: buildAddressLine(tx.paon, tx.saon, tx.street, tx.locality, tx.town),
    import_month: importMonth,
  }
}

/**
 * Batch-upsert an array of transactions into the property_transactions table.
 * Returns counts of inserted and skipped rows.
 */
async function upsertBatch(
  supabase: ReturnType<typeof createAdminClient>,
  rows: DbRow[]
): Promise<{ inserted: number; skipped: number }> {
  const { error, count } = await supabase
    .from('property_transactions')
    .upsert(rows, {
      onConflict: 'transaction_id,import_month',
      count: 'exact',
    })

  if (error) {
    // Fail loudly. Swallowing this is how a totally broken import (e.g. the
    // database briefly unreachable) used to report "success" and produce no data.
    throw new Error(`Batch upsert failed: ${error.message}`)
  }

  return { inserted: count ?? rows.length, skipped: 0 }
}

/**
 * Full import pipeline:
 * 1. Stream CSV from HMLR
 * 2. Parse and filter (category A only)
 * 3. Batch upsert into property_transactions
 * 4. Handle deletions
 */
export async function runImport(importMonth: string): Promise<ImportResult> {
  const supabase = createAdminClient()

  const stream = await fetchLandRegistryCsvStream()
  const parser = parseLandRegistryCsvStream(stream)

  let rowsDownloaded = 0
  let rowsInserted = 0
  let rowsSkipped = 0
  let rowsDeleted = 0

  const insertBatch: DbRow[] = []
  const deleteIds: string[] = []

  for await (const tx of parser) {
    rowsDownloaded++

    if (tx.recordStatus === 'D') {
      deleteIds.push(tx.transactionId)
      if (deleteIds.length >= BATCH_SIZE) {
        await deleteTransactions(supabase, deleteIds, importMonth)
        rowsDeleted += deleteIds.length
        deleteIds.length = 0
      }
      continue
    }

    insertBatch.push(toDbRow(tx, importMonth))

    if (insertBatch.length >= BATCH_SIZE) {
      const { inserted, skipped } = await upsertBatch(supabase, [...insertBatch])
      rowsInserted += inserted
      rowsSkipped += skipped
      insertBatch.length = 0
    }
  }

  // Flush remaining inserts
  if (insertBatch.length > 0) {
    const { inserted, skipped } = await upsertBatch(supabase, insertBatch)
    rowsInserted += inserted
    rowsSkipped += skipped
  }

  // Flush remaining deletes
  if (deleteIds.length > 0) {
    await deleteTransactions(supabase, deleteIds, importMonth)
    rowsDeleted += deleteIds.length
  }

  // Geocode this month's freshly imported rows so lead generation can use them.
  const geo = await geocodeTransactionsForMonth(importMonth)

  return {
    rowsDownloaded,
    rowsInserted,
    rowsSkipped,
    rowsDeleted,
    rowsGeocoded: geo.rowsGeocoded,
  }
}

/**
 * Delete transactions for the CURRENT import_month only.
 *
 * The table is keyed (transaction_id, import_month) — each month is its own
 * snapshot. Deleting by transaction_id alone wiped the row from every prior
 * month too, corrupting historical snapshots that other months' leads point at.
 */
async function deleteTransactions(
  supabase: ReturnType<typeof createAdminClient>,
  transactionIds: string[],
  importMonth: string
): Promise<void> {
  const { error } = await supabase
    .from('property_transactions')
    .delete()
    .eq('import_month', importMonth)
    .in('transaction_id', transactionIds)

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}
