/**
 * 判断一个值是否是 Promise-like 对象
 *
 * @param {any} value - 要判断的值
 */
export function isPromiseLike(value: any): boolean {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.then === 'function',
  )
}
