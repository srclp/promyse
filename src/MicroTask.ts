/**
 * 将一个函数注册为微任务，用于模拟 Promise 微队列
 *
 * @param {Function} task - 要注册的微任务函数
 */
export function registerMicroTask(task: () => void) {
  if (process && process.nextTick) {
    process.nextTick(task)
  }
  else if (MutationObserver) {
    const divEl = document.createElement('div')
    const ob = new MutationObserver(task)
    ob.observe(divEl, { childList: true })
    divEl.appendChild(document.createTextNode(''))
  }
  else {
    setTimeout(task)
  }
}
