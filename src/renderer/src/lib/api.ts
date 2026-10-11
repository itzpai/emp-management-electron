export type ElectronApi = Window['api']

export function hasElectronApi(): boolean {
  return typeof window !== 'undefined' && typeof window.api !== 'undefined'
}

export function getElectronApi(): ElectronApi {
  if (!hasElectronApi()) {
    throw new Error(
      'window.api is not available: the Electron preload script did not run. ' +
        'Make sure the renderer is loaded inside the Electron window (npm run dev), ' +
        'not opened as a plain web page in a browser.'
    )
  }
  return window.api
}
