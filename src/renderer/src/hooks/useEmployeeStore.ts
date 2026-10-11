import { useCallback, useEffect, useRef, useState } from 'react'
import type { Employee, EmployeeInput, IpcResult } from '@shared/employee'
import { getElectronApi } from '@/lib/api'

const SEARCH_DEBOUNCE_MS = 300

interface EmployeeStore {
  employees: Employee[]
  total: number
  page: number
  pageCount: number
  limit: number
  search: string
  department: string | undefined
  departments: string[]
  isLocked: boolean
  initialized: boolean
  setSearch: (value: string) => void
  setDepartment: (value: string | undefined) => void
  setLimit: (value: number) => void
  setPage: (value: number) => void
  addEmployee: (input: EmployeeInput) => Promise<IpcResult<Employee>>
  updateEmployee: (id: number, input: EmployeeInput) => Promise<IpcResult<Employee>>
  deleteEmployee: (id: number) => Promise<IpcResult<null>>
  exportEmployees: () => Promise<IpcResult<string>>
  exportEmployeesCsv: () => Promise<IpcResult<string>>
  importEmployees: () => Promise<IpcResult<number>>
  importEmployeesCsv: () => Promise<IpcResult<number>>
  toggleLock: (pin: string) => Promise<IpcResult<{ isLocked: boolean }>>
}

export function useEmployeeStore(): EmployeeStore {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPageState] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [limit, setLimitState] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [department, setDepartmentState] = useState<string | undefined>(undefined)
  const [departments, setDepartments] = useState<string[]>([])
  const [isLocked, setIsLocked] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [version, setVersion] = useState(0)
  const initRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const init = async (): Promise<void> => {
      const lockRes = await window.api.getLockStatus()
      if (lockRes.success) setIsLocked(lockRes.data.isLocked)
      setInitialized(true)
    }

    void init()
  }, [])

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      const res = await window.api.getEmployees({
        page,
        limit,
        search: searchValue || undefined,
        department
      })
      if (cancelled || !res.success) return
      setEmployees(res.data.employees)
      setTotal(res.data.total)
      setPageCount(res.data.pageCount)
      if (page > res.data.pageCount) setPageState(res.data.pageCount)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, limit, searchValue, department, version])

  useEffect(() => {
    if (!initialized) return
    let cancelled = false
    const load = async (): Promise<void> => {
      const res = await window.api.getDepartments()
      if (!cancelled && res.success) setDepartments(res.data)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [initialized, version])

  const setSearch = useCallback((value: string): void => {
    setSearchText(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchValue(value)
      setPageState(1)
    }, SEARCH_DEBOUNCE_MS)
  }, [])

  const setDepartment = useCallback((value: string | undefined): void => {
    setDepartmentState(value)
    setPageState(1)
  }, [])

  const setLimit = useCallback((value: number): void => {
    setLimitState(value)
    setPageState(1)
  }, [])

  const setPage = useCallback(
    (value: number): void => {
      setPageState(Math.min(Math.max(1, value), pageCount))
    },
    [pageCount]
  )

  const mutate = useCallback(
    async <T>(action: () => Promise<IpcResult<T>>): Promise<IpcResult<T>> => {
      const res = await action()
      if (res.success) setVersion((v) => v + 1)
      return res
    },
    []
  )

  const addEmployee = useCallback(
    (input: EmployeeInput) => mutate(() => window.api.addEmployee(input)),
    [mutate]
  )

  const updateEmployee = useCallback(
    (id: number, input: EmployeeInput) => mutate(() => window.api.updateEmployee(id, input)),
    [mutate]
  )

  const deleteEmployee = useCallback(
    (id: number) => mutate(() => window.api.deleteEmployee(id)),
    [mutate]
  )

  const importEmployees = useCallback(() => mutate(() => window.api.importEmployees()), [mutate])

  const importEmployeesCsv = useCallback(
    () => mutate(() => window.api.importEmployeesCsv()),
    [mutate]
  )

  const toggleLock = useCallback(async (pin: string) => {
    const res = await window.api.toggleLock(pin)
    if (res.success) setIsLocked(res.data.isLocked)
    return res
  }, [])

  const exportEmployees = useCallback(
    () => mutate(() => getElectronApi().exportEmployees()),
    [mutate]
  )

  const exportEmployeesCsv = useCallback(
    () => mutate(() => getElectronApi().exportEmployeesCsv()),
    [mutate]
  )

  return {
    employees,
    total,
    page,
    pageCount,
    limit,
    search: searchText,
    department,
    departments,
    isLocked,
    initialized,
    setSearch,
    setDepartment,
    setLimit,
    setPage,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    exportEmployees,
    exportEmployeesCsv,
    importEmployees,
    importEmployeesCsv,
    toggleLock
  }
}
