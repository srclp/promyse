import { registerMicroTask } from './MicroTask'
import { isPromiseLike } from './utils'

type Executor = (resolve: (data: any) => void, reject: (reason: any) => void) => void
enum State {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}

interface Handler {
  executor: undefined | ((data: any) => any)
  state: State.FULFILLED | State.REJECTED
  resolve: (data: any) => void
  reject: (reason: any) => void
}

export class Promyse {
  private _state: State = State.PENDING
  private _value: any = undefined
  private _handlers: Handler[] = []

  /**
   * @param {Function} executor - 任务执行器，立即执行。
   */
  constructor(executor: Executor) {
    try {
      executor(
        this._resovle.bind(this),
        this._reject.bind(this),
      )
    }
    catch (error) {
      this._reject(error)
    }
  }

  /**
   * 向处理队列中添加一个处理器
   *
   * @param {Function} executor - 处理器函数
   * @param {State} state - 处理器对应的状态（fulfilled 或 rejected）
   * @param {Function} resolve - 用于将下一个 Promise 标记为 fulfilled 的函数
   * @param {Function} reject - 用于将下一个 Promise 标记为 rejected 的函数
   */
  _pushHandler(
    executor: ((data: any) => any) | undefined,
    state: State.FULFILLED | State.REJECTED,
    resolve: (data: any) => void,
    reject: (reason: any) => void,
  ) {
    this._handlers.push({
      executor,
      state,
      resolve,
      reject,
    })
  }

  /**
   * 根据实际情况执行 Handler 队列
   */
  _runHandlers() {
    if (this._state === State.PENDING)
      return

    while (this._handlers.length) {
      const handler = this._handlers.shift()
      this._runOneHandler(handler!)
    }
  }

  /**
   * 处理单个 Handler，根据当前状态和 Handler 的预期状态执行相应的处理逻辑
   *
   * @param {Handler} handler - 要处理的 Handler 对象
   */
  _runOneHandler({ executor, state, resolve, reject }: Handler) {
    registerMicroTask(() => {
      if (this._state !== state)
        return

      if (typeof executor !== 'function') {
        this._state === State.FULFILLED
          ? resolve(this._value)
          : reject(this._value)

        return
      }
      try {
        const result = executor(this._value)
        if (isPromiseLike(result))
          result.then(resolve, reject)
        else
          resolve(result)
      }
      catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Promise A+ 规范的 then 方法。
   */
  then(
    onFulfilled: ((data: any) => any) | undefined,
    onRejected: ((reason: any) => any) | undefined,
  ) {
    return new Promyse((resolve, reject) => {
      this._pushHandler(onFulfilled, State.FULFILLED, resolve, reject)
      this._pushHandler(onRejected, State.REJECTED, resolve, reject)
      this._runHandlers()
    })
  }

  /**
   * 改变当前任务的状态和相关数据
   *
   * @param {State} newState - 新的状态
   * @param {any} value - 与状态相关的数据
   */
  private _changeStateAndValue(newState: State, value: any) {
    if (this._state !== State.PENDING)
      return

    this._state = newState
    this._value = value

    this._runHandlers()
  }

  /**
   * 标记当前任务完成
   *
   * @param {any} data - 任务完成时的结果数据
   */
  private _resovle(data: any) {
    this._changeStateAndValue(State.FULFILLED, data)
  }

  /**
   * 标记当前任务失败
   *
   * @param {any} reason - 任务失败的原因
   */
  private _reject(reason: any) {
    this._changeStateAndValue(State.REJECTED, reason)
  }

  catch(onRejected: (reason: any) => any) {
    return this.then(undefined, onRejected)
  }

  finally(onFinally: () => any) {
    return this.then(
      (data) => {
        onFinally()
        return data
      },
      (reason) => {
        onFinally()
        return reason
      },
    )
  }

  static resolve(data: any) {
    if (data instanceof Promyse) {
      return data
    }
    return new Promyse((resolve, reject) => {
      if (isPromiseLike(data)) {
        data.then(resolve, reject)
      }
      resolve(data)
    })
  }

  static reject(reason: any) {
    return new Promyse((resolve, reject) => {
      reject(reason)
    })
  }

  static all(pros: any) {
    return new Promyse((resolve, reject) => {
      let count = 0 // 用 count 实际上是 lenght 的作用，但是不是所有可迭代对象都有 lenght 属性
      let fulfilledCount = 0
      const result: any[] = []

      for (const p of pros) {
        const curCount = count++

        Promyse.resolve(p).then(
          (data: any) => {
            result[curCount] = data
            fulfilledCount++

            if (fulfilledCount === count)
              resolve(result)
          },
          reject,
        )
      }

      if (count === 0)
        resolve(result)
    })
  }

  static allSettled(pros: any) {
    const ps = []

    for (const p of pros) {
      ps.push(
        Promyse.resolve(p)
          .then(
            (data: any) => ({ status: State.FULFILLED, data }),
            (reason: any) => ({ status: State.REJECTED, reason }),
          ),
      )
    }

    return Promyse.all(ps)
  }
}
