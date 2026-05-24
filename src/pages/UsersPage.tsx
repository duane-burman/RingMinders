// Users list — sortable, searchable table of all user accounts
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUsers, useUpdateUserStatus } from '@/hooks/useUsers'
import type { User } from '@/hooks/useUsers'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatPhone } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function statusToggleLabel(status: User['status']): string {
  if (status === 'active') return 'Suspend'
  if (status === 'suspended') return 'Activate'
  return 'Enable'
}

function nextStatus(status: User['status']): string {
  if (status === 'active') return 'suspended'
  if (status === 'suspended') return 'active'
  return 'active'
}

export function UsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: users, isLoading, error } = useUsers()
  const updateStatus = useUpdateUserStatus()

  const filtered = users?.filter(u => {
    const q = search.toLowerCase()
    return (
      u.name.toLowerCase().includes(q) ||
      u.primary_phone.includes(q) ||
      (u.secondary_phone?.includes(q) ?? false)
    )
  }) ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text mb-1">Users</h1>
          <p className="text-text-muted text-sm">Manage user accounts.</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground"
          onClick={() => navigate('/users/new')}
        >
          Add User
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Primary Phone</TableHead>
              <TableHead>Secondary Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-muted text-sm py-12">
                  Loading users...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-muted text-sm py-12">
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {filtered.map(user => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium text-text">{user.name}</div>
                  {user.notes && (
                    <div className="text-xs text-text-muted">{user.notes}</div>
                  )}
                </TableCell>
                <TableCell>{formatPhone(user.primary_phone)}</TableCell>
                <TableCell>
                  {user.secondary_phone ? formatPhone(user.secondary_phone) : '—'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.status as Parameters<typeof StatusBadge>[0]['status']} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <i className="ti ti-dots-vertical text-base text-text-muted" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/users/${user.id}`)}>
                        <i className="ti ti-edit mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          updateStatus.mutate({ id: user.id, status: nextStatus(user.status) })
                        }
                      >
                        <i className="ti ti-refresh mr-2" />
                        {statusToggleLabel(user.status)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
