/** Ctrl(맥은 Cmd)을 눌렀는지. */
export function isModKey(event: {
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return event.ctrlKey || event.metaKey;
}

/** 고른 칸에 더하거나 빼는 누르기인지(Ctrl·Cmd·Shift). */
export function isAdditive(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  return isModKey(event) || event.shiftKey;
}
