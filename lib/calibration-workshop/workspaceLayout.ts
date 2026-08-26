export type WorkshopLayoutState = Readonly<{
  explorerCollapsed: boolean;
  inspectorCollapsed: boolean;
  focusWorkspace: boolean;
}>;

export function deriveWorkshopLayout(state: WorkshopLayoutState) {
  const explorerVisible = !state.focusWorkspace && !state.explorerCollapsed;
  const inspectorVisible = !state.focusWorkspace && !state.inspectorCollapsed;
  return Object.freeze({
    explorerVisible,
    inspectorVisible,
    columns: explorerVisible && inspectorVisible
      ? "xl:grid-cols-[300px_minmax(0,1fr)_320px]"
      : explorerVisible
        ? "xl:grid-cols-[300px_minmax(0,1fr)]"
        : inspectorVisible
          ? "xl:grid-cols-[minmax(0,1fr)_320px]"
          : "xl:grid-cols-1",
  });
}
