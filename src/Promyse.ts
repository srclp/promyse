type Executor = (resolve: (data: any) => void, reject: (reason: any) => void) => void
enum State {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
}

export class Promyse {
  private _state: State = State.PENDING
  private _value: any = undefined

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
   * Promise A+ 规范的 then 方法。
   */
  then(
    onFulfilled?: (data: any) => void,
    onRejected?: (reason: any) => void,
  ) {
    return new Promyse((resolve, reject) => {
      //
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
}
