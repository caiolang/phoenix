import React from "react";

import { Switch } from "@arizeai/components";

import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

/**
 * Enable / Disable auto refresh for projects
 */
export function ProjectsListGridToggle() {
  const projectsListGrid = usePreferencesContext(
    (state) => state.projectsListGrid
  );
  const setProjectListGrid = usePreferencesContext(
    (state) => state.setProjectListGrid
  );

  return (
    <Switch
      labelPlacement="start"
      isSelected={projectsListGrid}
      onChange={() => {
        setProjectListGrid(!projectsListGrid);
      }}
    >
      List/Grid
    </Switch>
  );
}
