'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  dryRunLegacyMigration,
  migrateLegacyDocument,
  scanLegacyMigrationCandidates,
  type LegacyMigrationCandidate,
  type LegacyMigrationDryRunReport,
  type LegacyMigrationResult,
} from '@/lib/local-first/legacyMigrationService'

export default function LegacyMigrationPage() {
  const [candidates, setCandidates] = useState<LegacyMigrationCandidate[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [report, setReport] = useState<LegacyMigrationDryRunReport | null>(null)
  const [result, setResult] = useState<LegacyMigrationResult | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [isBusy, setIsBusy] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const selected = candidates.find((candidate) => candidateKey(candidate) === selectedKey) ?? null
  const selectedReportBlocked = report ? candidateKey(report) === selectedKey && report.blocked : false

  useEffect(() => {
    void handleScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleScan() {
    setIsBusy(true)
    setReport(null)
    setResult(null)
    try {
      appendLog('scan started')
      const nextCandidates = await scanLegacyMigrationCandidates(supabase)
      setCandidates(nextCandidates)
      setSelectedKey((current) => current || (nextCandidates[0] ? candidateKey(nextCandidates[0]) : ''))
      appendLog(`scan completed: ${nextCandidates.length} candidates`)
    } catch (error) {
      appendLog(`scan failed: ${formatError(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDryRun() {
    if (!selected) return
    setIsBusy(true)
    setResult(null)
    try {
      appendLog(`dry-run started: ${selected.kind}:${selected.id}`)
      const nextReport = await dryRunLegacyMigration(supabase, selected)
      setReport(nextReport)
      appendLog(`dry-run completed: ${formatCounts(nextReport.entityCounts)}`)
    } catch (error) {
      appendLog(`dry-run failed: ${formatError(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  async function handleMigrate() {
    if (!selected || selected.existingDocument) return
    setIsBusy(true)
    try {
      appendLog(`migration started: ${selected.kind}:${selected.id}`)
      const nextResult = await migrateLegacyDocument(supabase, selected)
      setResult(nextResult)
      appendLog(`migration ${nextResult.status}: restore=${nextResult.restoreStatus}`)
      await handleScan()
    } catch (error) {
      appendLog(`migration failed: ${formatError(error)}`)
    } finally {
      setIsBusy(false)
    }
  }

  function appendLog(line: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 80))
  }

  return (
    <main style={{ padding: 24, maxWidth: 1080, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>Legacy Document Migration</h1>
      <p style={{ margin: '0 0 24px', color: '#4b5563' }}>
        로그인된 사용자 소유의 레거시 여행/템플릿을 선택해 document-primary snapshot으로 전환합니다.
      </p>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={handleScan} disabled={isBusy} style={buttonStyle}>
              Scan
            </button>
            <button type="button" onClick={handleDryRun} disabled={isBusy || !selected} style={buttonStyle}>
              Dry Run
            </button>
            <button
              type="button"
              onClick={handleMigrate}
              disabled={isBusy || !selected || selected.existingDocument || selectedReportBlocked}
              style={primaryButtonStyle}
            >
              Migrate Selected
            </button>
          </div>

          <div style={{ border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead style={{ background: '#f9fafb', textAlign: 'left' }}>
                <tr>
                  <th style={cellStyle}>선택</th>
                  <th style={cellStyle}>종류</th>
                  <th style={cellStyle}>이름</th>
                  <th style={cellStyle}>상태</th>
                  <th style={cellStyle}>요약</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidateKey(candidate)} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={cellStyle}>
                      <input
                        type="radio"
                        name="candidate"
                        checked={selectedKey === candidateKey(candidate)}
                        onChange={() => setSelectedKey(candidateKey(candidate))}
                      />
                    </td>
                    <td style={cellStyle}>{candidate.kind}</td>
                    <td style={cellStyle}>
                      <div style={{ fontWeight: 600 }}>{candidate.title}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>{candidate.id}</div>
                    </td>
                    <td style={cellStyle}>
                      {candidate.existingDocument ? 'already migrated' : 'row-only'}
                    </td>
                    <td style={cellStyle}>{formatCandidateDetails(candidate)}</td>
                  </tr>
                ))}
                {candidates.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...cellStyle, color: '#6b7280' }}>
                      후보가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={panelStyle}>
            <h2 style={panelTitleStyle}>Report</h2>
            {report ? (
              <>
                <div style={{ fontSize: 13, color: '#374151' }}>{formatCounts(report.entityCounts)}</div>
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  validation: {report.validationMessages.length}
                  {report.blocked ? ' (blocked)' : ''}
                </div>
                <ul style={{ paddingLeft: 18, margin: '8px 0 0', fontSize: 12, color: '#4b5563' }}>
                  {report.validationMessages.slice(0, 8).map((message) => (
                    <li key={`${message.code}:${message.rowId ?? ''}`}>{message.code}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#6b7280' }}>Dry Run 결과가 여기에 표시됩니다.</div>
            )}
          </section>

          <section style={panelStyle}>
            <h2 style={panelTitleStyle}>Result</h2>
            {result ? (
              <div style={{ fontSize: 13, color: '#374151' }}>
                status={result.status}
                <br />
                restore={result.restoreStatus}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#6b7280' }}>Migration 결과가 여기에 표시됩니다.</div>
            )}
          </section>

          <section style={panelStyle}>
            <h2 style={panelTitleStyle}>Log</h2>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, color: '#111827' }}>
              {log.join('\n')}
            </pre>
          </section>
        </aside>
      </section>
    </main>
  )
}

function candidateKey(candidate: Pick<LegacyMigrationCandidate, 'kind' | 'id'>): string {
  return `${candidate.kind}:${candidate.id}`
}

function formatCandidateDetails(candidate: LegacyMigrationCandidate): string {
  return Object.entries(candidate.details)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `${key}=${value}`)
    .join(', ') || '-'
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ')
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const cellStyle = {
  padding: '10px 12px',
  verticalAlign: 'top',
} satisfies CSSProperties

const buttonStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  padding: '8px 12px',
  cursor: 'pointer',
} satisfies CSSProperties

const primaryButtonStyle = {
  ...buttonStyle,
  borderColor: '#111827',
  background: '#111827',
  color: '#fff',
} satisfies CSSProperties

const panelStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: 14,
  background: '#fff',
} satisfies CSSProperties

const panelTitleStyle = {
  margin: '0 0 8px',
  fontSize: 15,
} satisfies CSSProperties
