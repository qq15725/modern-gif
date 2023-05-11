import { consoleDebug, consoleTime, consoleTimeEnd, consoleWarn } from './utils'

export function createLogger(debug: boolean) {
  return {
    time: (label: string) => debug && consoleTime(label),
    timeEnd: (label: string) => debug && consoleTimeEnd(label),
    debug: (...args: any[]) => debug && consoleDebug(...args),
    warn: (...args: any[]) => debug && consoleWarn(...args),
  }
}
