'use client';
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

// Simple pagination component (you can replace with your existing one)
function Pagination({ page, total, limit, onPageChange }: { page: number; total: number; limit: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / limit)
  return (
    <div className="flex items-center space-x-2 mt-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Prev
      </Button>
      <span className="text-sm">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </div>
  )
}

export default function WebhookLogPage() {
  const { profile } = useAuth()
  const pathname = usePathname()
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 20
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      const res = await fetch(`/api/debug/webhook-logs?page=${page}&limit=${limit}`)
      const data = await res.json()
      if (res.ok) {
        setLogs(data.rows ?? [])
        setTotal(data.total ?? 0)
      } else {
        console.error('Failed to fetch webhook logs:', data)
      }
    }
    fetchLogs()
  }, [page])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Webhook Debug Log</h1>
      <Table className="border rounded-md overflow-hidden">
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payload Preview</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="hover:bg-slate-800/30 cursor-pointer" onClick={() => setSelected(log)}>
              <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
              <TableCell>{log.note?.startsWith('error=') ? '❌ Rejected' : '✅ Received'}</TableCell>
              <TableCell className="truncate max-w-xs">{JSON.stringify(log.body).slice(0, 80)}{JSON.stringify(log.body).length > 80 ? '…' : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />

      {/* Payload modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Webhook Payload</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm">
            {selected ? JSON.stringify(selected.body, null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
