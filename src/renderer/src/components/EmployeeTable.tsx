import type { JSX } from 'react'
import { Check, ChevronLeft, ChevronRight, Filter, Pencil, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { Employee } from '@shared/employee'

const PAGE_SIZES = [10, 25, 50] as const

interface EmployeeTableProps {
  employees: Employee[]
  total: number
  page: number
  pageCount: number
  limit: number
  search: string
  department: string | undefined
  departments: string[]
  isLocked: boolean
  onSearchChange: (value: string) => void
  onDepartmentChange: (value: string | undefined) => void
  onLimitChange: (value: number) => void
  onPageChange: (value: number) => void
  onEdit: (employee: Employee) => void
  onDelete: (employee: Employee) => void
}

function formatSalary(salary: number): string {
  return salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function EmployeeTable({
  employees,
  total,
  page,
  pageCount,
  limit,
  search,
  department,
  departments,
  isLocked,
  onSearchChange,
  onDepartmentChange,
  onLimitChange,
  onPageChange,
  onEdit,
  onDelete
}: EmployeeTableProps): JSX.Element {
  const isFiltered = search.length > 0 || department !== undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employees</CardTitle>
        <CardDescription>
          {total} {total === 1 ? 'record' : 'records'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search name, position, department…"
              className="pl-8"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter />
                {department ?? 'All departments'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => onDepartmentChange(undefined)}>
                <Check className={department === undefined ? 'opacity-100' : 'opacity-0'} />
                All departments
              </DropdownMenuItem>
              {departments.map((d) => (
                <DropdownMenuItem key={d} onSelect={() => onDepartmentChange(d)}>
                  <Check className={department === d ? 'opacity-100' : 'opacity-0'} />
                  {d}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Salary</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {isFiltered ? 'No employees match your search.' : 'No employees yet.'}
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.phone || '—'}</TableCell>
                  <TableCell>{employee.joinedDate}</TableCell>
                  <TableCell className="text-right">{formatSalary(employee.salary)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLocked}
                        onClick={() => onEdit(employee)}
                      >
                        <Pencil />
                        <span className="sr-only">Edit {employee.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLocked}
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(employee)}
                      >
                        <Trash2 />
                        <span className="sr-only">Delete {employee.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {limit} / page
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PAGE_SIZES.map((size) => (
                <DropdownMenuItem key={size} onSelect={() => onLimitChange(size)}>
                  <Check className={limit === size ? 'opacity-100' : 'opacity-0'} />
                  {size} / page
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
