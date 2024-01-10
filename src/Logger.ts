export class Logger {
  static prefix = '[modern-gif]'

  constructor(
    protected _debug = true,
  ) {
    //
  }

  time(label: string): void {
    if (!this._debug) return
    // eslint-disable-next-line no-console
    console.time(`${ Logger.prefix } ${ label }`)
  }

  timeEnd(label: string): void {
    if (!this._debug) return
    // eslint-disable-next-line no-console
    console.timeEnd(`${ Logger.prefix } ${ label }`)
  }

  debug(...args: any[]): void {
    if (!this._debug) return
    // eslint-disable-next-line no-console
    console.debug(Logger.prefix, ...args)
  }

  warn(...args: any[]): void {
    if (!this._debug) return
    // eslint-disable-next-line no-console
    console.warn(Logger.prefix, ...args)
  }
}
