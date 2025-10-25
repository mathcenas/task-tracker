import { Task } from '../types';

/**
 * Filters out auto-generated recurring task reminders from task lists
 * These are tasks created by the recurring task system that haven't been completed yet
 */
export function filterOutPendingRecurringReminders(tasks: Task[]): Task[] {
  return tasks.filter(task => {
    // Keep completed recurring tasks (they've been worked on and should count)
    if (task.finished) return true;

    // Filter out pending recurring task reminders
    if (task.isRecurring && !task.finished) return false;

    // Keep all other tasks
    return true;
  });
}

/**
 * Gets only the pending recurring task reminders
 */
export function getPendingRecurringReminders(tasks: Task[]): Task[] {
  return tasks.filter(task => task.isRecurring && !task.finished);
}

/**
 * Checks if a task is a recurring reminder
 */
export function isRecurringReminder(task: Task): boolean {
  return task.isRecurring === true && !task.finished;
}
