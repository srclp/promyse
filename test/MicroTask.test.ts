import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerMicroTask } from '../src/MicroTask'

const nextTickDescriptor = Object.getOwnPropertyDescriptor(process, 'nextTick')
const originalMutationObserver = globalThis.MutationObserver
const originalDocument = globalThis.document

afterEach(() => {
  vi.restoreAllMocks()

  if (nextTickDescriptor) {
    Object.defineProperty(process, 'nextTick', nextTickDescriptor)
  }

  if (originalMutationObserver === undefined) {
    vi.unstubAllGlobals()
  }
  else {
    vi.stubGlobal('MutationObserver', originalMutationObserver)
    if (originalDocument === undefined)
      vi.unstubAllGlobals()
    else
      vi.stubGlobal('document', originalDocument)
  }
})

describe('registerMicroTask', () => {
  it('优先使用 process.nextTick 注册微任务', () => {
    const task = vi.fn()
    const nextTick = vi.fn((callback: () => void) => {
      callback()
    })

    Object.defineProperty(process, 'nextTick', {
      configurable: true,
      value: nextTick,
    })

    registerMicroTask(task)

    expect(nextTick).toHaveBeenCalledOnce()
    expect(nextTick).toHaveBeenCalledWith(task)
    expect(task).toHaveBeenCalledOnce()
  })

  it('在没有 process.nextTick 时使用 MutationObserver 模拟微队列', () => {
    const task = vi.fn()
    const observe = vi.fn((target: { __observer?: () => void }) => {
      target.__observer = task
    })
    const appendChild = vi.fn(function (this: { __observer?: () => void }) {
      this.__observer?.()
    })
    const createElement = vi.fn(() => ({ appendChild }))
    const createTextNode = vi.fn(() => ({}))

    Object.defineProperty(process, 'nextTick', {
      configurable: true,
      value: undefined,
    })

    class MockMutationObserver {
      constructor(private readonly callback: () => void) {}

      observe(target: { __observer?: () => void }) {
        observe(target)
        target.__observer = this.callback
      }
    }

    vi.stubGlobal('MutationObserver', MockMutationObserver)
    vi.stubGlobal('document', {
      createElement,
      createTextNode,
    })

    registerMicroTask(task)

    expect(createElement).toHaveBeenCalledWith('div')
    expect(observe).toHaveBeenCalledOnce()
    expect(createTextNode).toHaveBeenCalledWith('')
    expect(appendChild).toHaveBeenCalledOnce()
    expect(task).toHaveBeenCalledOnce()
  })

  it('在没有微任务能力时退回到 setTimeout', () => {
    const task = vi.fn()
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((callback: () => void) => {
        callback()
        return 0 as unknown as ReturnType<typeof setTimeout>
      }) as typeof setTimeout)

    Object.defineProperty(process, 'nextTick', {
      configurable: true,
      value: undefined,
    })
    vi.stubGlobal('MutationObserver', undefined)

    registerMicroTask(task)

    expect(setTimeoutSpy).toHaveBeenCalledOnce()
    expect(setTimeoutSpy).toHaveBeenCalledWith(task)
    expect(task).toHaveBeenCalledOnce()
  })
})
