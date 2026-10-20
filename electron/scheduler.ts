/**
 * Runs saved actions when their time arrives, including while the hub is hidden.
 */
import { Notification } from 'electron'
import { randomUUID } from 'node:crypto'
import type { ParsedAction, ScheduledTask } from './types'
import { getScheduledTasks, setScheduledTasks } from './storage'

const MISSED_MS = 6 * 60 * 60 * 1000

function read(): ScheduledTask[] {
  return getScheduledTasks()
}

function write(tasks: ScheduledTask[]): void {
  setScheduledTasks(tasks)
}

export function enqueueTask(action: ParsedAction, label: string): ScheduledTask {
  const task: ScheduledTask = {
    id: randomUUID(),
    runAt: action.runAt ?? Date.now(),
    label,
    action,
    createdAt: Date.now(),
  }
  write([...read(), task])
  return task
}

type Runner = (action: ParsedAction) => Promise<{ success: boolean; message: string } | null>

let timer: ReturnType<typeof setInterval> | null = null

export function startScheduler(run: Runner): void {
  if (timer) return
  const tick = async () => {
    const due = read()
      .filter((task) => task.runAt <= Date.now())
      .sort((a, b) => a.runAt - b.runAt)
    if (!due.length) return

    const task = due[0]
    const rest = read().filter((item) => item.id !== task.id)
    write(rest)

    const late = Date.now() - task.runAt
    if (late > MISSED_MS) {
      if (Notification.isSupported()) {
        new Notification({
          title: 'EchoFlow missed a scheduled task',
          body: task.label.slice(0, 180),
        }).show()
      }
      return
    }

    const result = await run(task.action)
    if (!result) {
      write([...read(), task])
      return
    }
    if (Notification.isSupported()) {
      new Notification({
        title: result.success ? 'EchoFlow' : 'EchoFlow could not finish a scheduled task',
        body: result.message.slice(0, 180),
      }).show()
    }
  }

  timer = setInterval(() => {
    void tick()
  }, 15_000)
  void tick()
}
