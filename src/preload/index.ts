import { contextBridge, ipcRenderer } from 'electron'
import type { EmployeeInput, EmployeeQuery } from '@shared/employee'

contextBridge.exposeInMainWorld('api', {
  getEmployees: (query?: EmployeeQuery) => ipcRenderer.invoke('get-employees', query),
  getDepartments: () => ipcRenderer.invoke('get-departments'),
  addEmployee: (data: EmployeeInput) => ipcRenderer.invoke('add-employee', data),
  updateEmployee: (id: number, data: EmployeeInput) =>
    ipcRenderer.invoke('update-employee', id, data),
  deleteEmployee: (id: number) => ipcRenderer.invoke('delete-employee', id),
  exportEmployees: () => ipcRenderer.invoke('export-employees'),
  exportEmployeesCsv: () => ipcRenderer.invoke('export-employees-csv'),
  importEmployees: () => ipcRenderer.invoke('import-employees'),
  importEmployeesCsv: () => ipcRenderer.invoke('import-employees-csv'),
  getLockStatus: () => ipcRenderer.invoke('get-lock-status'),
  toggleLock: (pin: string) => ipcRenderer.invoke('toggle-lock', pin),
  changePin: (currentPin: string, newPin: string) =>
    ipcRenderer.invoke('change-pin', currentPin, newPin)
})
