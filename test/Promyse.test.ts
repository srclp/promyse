/* eslint-disable no-new */
import { Promyse } from '../src/Promyse'

function inspectPromyse(promyse: Promyse) {
  return promyse as unknown as {
    _state: 'pending' | 'fulfilled' | 'rejected'
    _value: unknown
  }
}

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
})
