/**
 * WriteFlow 并发工具协调器 - 实现 AsyncGenerator 并发架构
 * 支持多个 AsyncGenerator 的并发执行和结果流式推送
 */

const NO_VALUE = Symbol('NO_VALUE')

/**
 * 获取异步生成器的最后一个值 - 标准实现
 */
export async function lastX<A>(as: AsyncGenerator<A>): Promise<A> {
  let lastValue: A | typeof NO_VALUE = NO_VALUE
  for await (const a of as) {
    lastValue = a
  }
  if (lastValue === NO_VALUE) {
    throw new Error('No items in generator')
  }
  return lastValue
}

/**
 * 队列中的生成器类型定义 - 流式架构类型
 */
type QueuedGenerator<A> = {
  done: boolean | void
  value: A | void
  generator: AsyncGenerator<A, void>
  promise: Promise<QueuedGenerator<A>>
}

/**
 * 并发运行多个生成器，实时 yield 结果 - AsyncGenerator 并发执行核心
 * 这是实时工具执行显示的关键函数！
 * 
 * @param generators 要并发执行的异步生成器数组
 * @param concurrencyCap 并发数量限制，默认无限制
 */
export async function* all<A>(
  generators: AsyncGenerator<A, void>[],
  concurrencyCap = Infinity,
): AsyncGenerator<A, void> {
  const next = (generator: AsyncGenerator<A, void>) => {
    const promise: Promise<QueuedGenerator<A>> = generator
      .next()
      .then(({ done, value }) => ({
        done,
        value,
        generator,
        promise,
      }))
    return promise
  }
  
  const waiting = [...generators]
  const promises = new Set<Promise<QueuedGenerator<A>>>()

  // 启动初始批次，最多到并发上限
  while (promises.size < concurrencyCap && waiting.length > 0) {
    const gen = waiting.shift()!
    promises.add(next(gen))
  }

  // 主循环：等待任何一个生成器产生值
  while (promises.size > 0) {
    const { done, value, generator, promise } = await Promise.race(promises)
    promises.delete(promise)

    if (!done) {
      // 生成器还没完成，继续监听下一个值
      promises.add(next(generator))
      // 如果有值就 yield 出去 - 这是实时显示的关键！
      if (value !== undefined) {
        yield value as A
      }
    } else if (waiting.length > 0) {
      // 当前生成器完成了，如果还有等待的就启动新的
      const nextGen = waiting.shift()!
      promises.add(next(nextGen))
    }
  }
}