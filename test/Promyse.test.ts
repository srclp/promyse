/* eslint-disable no-new */
import { afterEach, vi } from 'vitest'
import { Promyse } from '../src/Promyse'

function inspectPromyse(promyse: Promyse) {
  const instance = promyse as unknown as {
    _state: 'pending' | 'fulfilled' | 'rejected'
    _value: unknown
  }

  return {
    _state: instance._state,
    _value: instance._value,
  }
}

async function flushMicroTasks() {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('promyse', () => {
  it('会立即执行传入的执行器', () => {
    let executed = false

    new Promyse(() => {
      executed = true
    })

    expect(executed).toBe(true)
  })

  it('在未决议前初始状态应为 pending', () => {
    let resolveFn: ((value: unknown) => void) | undefined

    const promyse = new Promyse((resolve) => {
      resolveFn = resolve
    })

    expect(inspectPromyse(promyse)).toEqual({
      _state: 'pending',
      _value: undefined,
    })
    expect(resolveFn).toBeTypeOf('function')
  })

  it('调用 resolve 后会变为 fulfilled 并保存结果值', () => {
    const promyse = new Promyse((resolve) => {
      resolve('done')
    })

    expect(inspectPromyse(promyse)).toEqual({
      _state: 'fulfilled',
      _value: 'done',
    })
  })

  it('调用 reject 后会变为 rejected 并保存拒因', () => {
    const reason = new Error('boom')
    const promyse = new Promyse((_resolve, reject) => {
      reject(reason)
    })

    expect(inspectPromyse(promyse)).toEqual({
      _state: 'rejected',
      _value: reason,
    })
  })

  it('多次决议时只保留第一次 resolve 的结果', () => {
    const promyse = new Promyse((resolve, reject) => {
      resolve('first')
      reject(new Error('ignored'))
      resolve('second')
    })

    expect(inspectPromyse(promyse)).toEqual({
      _state: 'fulfilled',
      _value: 'first',
    })
  })

  it('多次决议时只保留第一次 reject 的拒因', () => {
    const firstReason = new Error('first')
    const promyse = new Promyse((resolve, reject) => {
      reject(firstReason)
      resolve('ignored')
    })

    expect(inspectPromyse(promyse)).toEqual({
      _state: 'rejected',
      _value: firstReason,
    })
  })

  it('执行器在决议前抛错时会进入 rejected', () => {
    const error = new Error('executor failed')
    const promyse = new Promyse(() => {
      throw error
    })

    expect(inspectPromyse(promyse)).toEqual({
      _state: 'rejected',
      _value: error,
    })
  })

  it('在已经 resolve 后再抛错不会覆盖已完成状态', () => {
    const promyse = new Promyse((resolve) => {
      resolve('done')
      throw new Error('ignored after resolve')
    })

    expect(inspectPromyse(promyse)).toEqual({
      _state: 'fulfilled',
      _value: 'done',
    })
  })

  it('传出的 resolve 和 reject 回调绑定了正确实例', () => {
    let resolveFn: ((value: unknown) => void) | undefined
    let rejectFn: ((reason: unknown) => void) | undefined

    const fulfilled = new Promyse((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })

    resolveFn?.('later')
    rejectFn?.(new Error('ignored'))

    expect(inspectPromyse(fulfilled)).toEqual({
      _state: 'fulfilled',
      _value: 'later',
    })
  })

  it('then 会返回一个新的 Promyse 实例', () => {
    const promyse = new Promyse(resolve => resolve('done'))
    const chained = promyse.then(value => value, undefined)

    expect(chained).toBeInstanceOf(Promyse)
    expect(chained).not.toBe(promyse)
  })

  it('fulfilled 状态的 then 回调会在微任务中异步执行', async () => {
    const callOrder: string[] = []
    const promyse = new Promyse(resolve => resolve('done'))

    promyse.then((value) => {
      callOrder.push(`handler:${value}`)
    }, undefined)

    callOrder.push('sync')

    expect(callOrder).toEqual(['sync'])

    await flushMicroTasks()

    expect(callOrder).toEqual(['sync', 'handler:done'])
  })

  it('rejected 状态的 then 回调会在微任务中异步执行', async () => {
    const callOrder: string[] = []
    const promyse = new Promyse((_resolve, reject) => reject('boom'))

    promyse.then(undefined, (reason) => {
      callOrder.push(`handler:${reason}`)
    })

    callOrder.push('sync')

    expect(callOrder).toEqual(['sync'])

    await flushMicroTasks()

    expect(callOrder).toEqual(['sync', 'handler:boom'])
  })

  it('onFulfilled 的返回值会传给下一个 then', async () => {
    const chained = new Promyse(resolve => resolve(1))
      .then(value => value + 1, undefined)

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 2,
    })
  })

  it('省略 onFulfilled 时会透传 fulfilled 的值', async () => {
    const chained = new Promyse(resolve => resolve('pass-through'))
      .then(undefined, undefined)

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 'pass-through',
    })
  })

  it('省略 onRejected 时会透传 rejected 的原因', async () => {
    const reason = new Error('pass-through')
    const chained = new Promyse((_resolve, reject) => reject(reason))
      .then(undefined, undefined)

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'rejected',
      _value: reason,
    })
  })

  it('onRejected 返回普通值时会让下一个 Promyse 变为 fulfilled', async () => {
    const chained = new Promyse((_resolve, reject) => reject('boom'))
      .then(undefined, reason => `recovered:${reason}`)

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 'recovered:boom',
    })
  })

  it('then 回调抛错时会让下一个 Promyse 进入 rejected', async () => {
    const error = new Error('handler failed')
    const chained = new Promyse(resolve => resolve('done'))
      .then(() => {
        throw error
      }, undefined)

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'rejected',
      _value: error,
    })
  })

  it('then 返回 promise-like 对象时会吸收其 fulfilled 结果', async () => {
    const chained = new Promyse(resolve => resolve('start'))
      .then(() => ({
        then(resolve: (value: string) => void) {
          resolve('nested done')
        },
      }), undefined)

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 'nested done',
    })
  })

  it('then 返回 promise-like 对象时会吸收其 rejected 原因', async () => {
    const reason = new Error('nested failed')
    const chained = new Promyse(resolve => resolve('start'))
      .then(() => ({
        then(
          _resolve: (value: string) => void,
          reject: (reason: Error) => void,
        ) {
          reject(reason)
        },
      }), undefined)

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'rejected',
      _value: reason,
    })
  })

  it('在 Promyse 已经完成后调用 then 也会继续执行处理器', async () => {
    const promyse = new Promyse(resolve => resolve('done'))
    const onFulfilled = vi.fn((value: string) => value)

    const chained = promyse.then(onFulfilled, undefined)

    expect(onFulfilled).not.toHaveBeenCalled()

    await flushMicroTasks()

    expect(onFulfilled).toHaveBeenCalledOnce()
    expect(onFulfilled).toHaveBeenCalledWith('done')
    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 'done',
    })
  })

  it('catch 会返回一个新的 Promyse 实例', () => {
    const promyse = new Promyse((_resolve, reject) => reject('boom'))
    const chained = promyse.catch(reason => reason)

    expect(chained).toBeInstanceOf(Promyse)
    expect(chained).not.toBe(promyse)
  })

  it('catch 会在 rejected 时处理错误并恢复为 fulfilled', async () => {
    const chained = new Promyse((_resolve, reject) => reject('boom'))
      .catch(reason => `recovered:${reason}`)

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 'recovered:boom',
    })
  })

  it('catch 不会处理 fulfilled 的值，且会继续透传', async () => {
    const onRejected = vi.fn()
    const chained = new Promyse(resolve => resolve('done'))
      .catch(onRejected)

    await flushMicroTasks()

    expect(onRejected).not.toHaveBeenCalled()
    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 'done',
    })
  })

  it('catch 回调抛错时会让返回的 Promyse 进入 rejected', async () => {
    const error = new Error('catch failed')
    const chained = new Promyse((_resolve, reject) => reject('boom'))
      .catch(() => {
        throw error
      })

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'rejected',
      _value: error,
    })
  })

  it('finally 会在 fulfilled 后执行，并透传原始值', async () => {
    const onFinally = vi.fn()
    const chained = new Promyse(resolve => resolve('done'))
      .finally(onFinally)

    await flushMicroTasks()

    expect(onFinally).toHaveBeenCalledOnce()
    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 'done',
    })
  })

  it('简易 finally 会在 rejected 后执行，并将拒因作为 fulfilled 值继续传递', async () => {
    const onFinally = vi.fn()
    const reason = new Error('boom')
    const chained = new Promyse((_resolve, reject) => reject(reason))
      .finally(onFinally)

    await flushMicroTasks()

    expect(onFinally).toHaveBeenCalledOnce()
    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: reason,
    })
  })

  it('简易 finally 不会等待 onFinally 返回的 promise-like 对象', async () => {
    let finallyResolved = false
    const chained = new Promyse(resolve => resolve('done'))
      .finally(() => new Promyse((resolve) => {
        setTimeout(() => {
          finallyResolved = true
          resolve(undefined)
        }, 0)
      }))

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: 'done',
    })
    expect(finallyResolved).toBe(false)
  })

  it('finally 抛错时会覆盖原本的 fulfilled 结果', async () => {
    const error = new Error('finally failed')
    const chained = new Promyse(resolve => resolve('done'))
      .finally(() => {
        throw error
      })

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'rejected',
      _value: error,
    })
  })

  it('简易 finally 不会处理 onFinally 返回的 rejected promise-like', async () => {
    const originalReason = new Error('original')
    const chained = new Promyse((_resolve, reject) => reject(originalReason))
      .finally(() => new Promyse((_resolve, reject) => reject(new Error('finally rejected'))))

    await flushMicroTasks()

    expect(inspectPromyse(chained)).toEqual({
      _state: 'fulfilled',
      _value: originalReason,
    })
  })
})
