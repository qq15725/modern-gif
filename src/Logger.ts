export class Logger {
  static prefix = '[modern-gif]'

  constructor(
    public isDebug = true,
  ) {
    //
  }

  time(label: string): void {
    if (!this.isDebug)
      return
    // eslint-disable-next-line no-console
    console.time(`${Logger.prefix} ${label}`)
  }

  timeEnd(label: string): void {
    if (!this.isDebug)
      return
    // eslint-disable-next-line no-console
    console.timeEnd(`${Logger.prefix} ${label}`)
  }

  debug(...args: any[]): void {
    if (!this.isDebug)
      return
    // eslint-disable-next-line no-console
    console.debug(Logger.prefix, ...args)
  }

  warn(...args: any[]): void {
    if (!this.isDebug)
      return

    console.warn(Logger.prefix, ...args)
  }
}
