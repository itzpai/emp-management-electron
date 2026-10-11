import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Employee,
  EmployeeInput,
  EmployeePage,
  EmployeeQuery,
  IpcResult
} from '@shared/employee'

export interface IApi {
  getEmployees: (query?: EmployeeQuery) => Promise<IpcResult<EmployeePage>>
  getDepartments: () => Promise<IpcResult<string[]>>
  addEmployee: (data: EmployeeInput) => Promise<IpcResult<Employee>>
  updateEmployee: (id: number, data: EmployeeInput) => Promise<IpcResult<Employee>>
  deleteEmployee: (id: number) => Promise<IpcResult<null>>
  exportEmployees: () => Promise<IpcResult<string>>
  exportEmployeesCsv: () => Promise<IpcResult<string>>
  importEmployees: () => Promise<IpcResult<number>>
  importEmployeesCsv: () => Promise<IpcResult<number>>
  getLockStatus: () => Promise<IpcResult<{ isLocked: boolean }>>
  toggleLock: (pin: string) => Promise<IpcResult<{ isLocked: boolean }>>
  changePin: (currentPin: string, newPin: string) => Promise<IpcResult<null>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: IApi
  }
}
