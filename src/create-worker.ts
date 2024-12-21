export interface WorkerOptions {
  workerUrl?: string
  workerNumber?: number
}

export interface WorkerEvent {
  id: number
  data: any
}

export interface CreatedWorker {
  call: (type: string, data: any, transfer?: Transferable[], index?: number) => Promise<any>
}

export function createWorker(options: WorkerOptions): CreatedWorker {
  const callbacks = new Map<number, any>()
  const { workerUrl } = options
  let { workerNumber = 1 } = options

  const workers = [...Array.from({ length: workerUrl ? workerNumber : 0 })]
    .map(() => {
      try {
        const worker = new Worker(workerUrl!)
        worker.onmessage = onMessage
        return worker
      }
      catch (err: any) {
        console.warn(err)
        return null
      }
    })
    .filter(Boolean)
  workerNumber = workers.length

  function onMessage(event: MessageEvent<WorkerEvent>): void {
    const { id, data } = event.data
    callbacks.get(id)?.(data)
    callbacks.delete(id)
  }

  const getWorker = (function () {
    let id = 0
    return (index?: number) => workers[(index ?? id++) % workerNumber]
  }())

  const call = (function () {
    let id = 0
    return (type: string, data: any, transfer?: Transferable[], index?: number): Promise<any> => {
      return new Promise((resolve) => {
        const worker = getWorker(index)
        if (!worker)
          return resolve(undefined)
        callbacks.set(id, resolve)
        worker.postMessage({ id: id++, type, data }, { transfer })
      })
    }
  }())

  return {
    call,
  }
}
