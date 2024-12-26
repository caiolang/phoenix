import React, { ReactNode, Suspense, useState } from "react";

import {
  DialogContainer,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@arizeai/components";

import { Button } from "@phoenix/components";

import { DatasetHistoryDialog } from "./DatasetHistoryDialog";

export function DatasetHistoryButton(props: { datasetId: string }) {
  const { datasetId } = props;
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <>
      <TooltipTrigger>
        <Button
          icon={<Icon svg={<Icons.ClockOutline />} />}
          aria-label="Version History"
          onPress={() => {
            setDialog(<DatasetHistoryDialog datasetId={datasetId} />);
          }}
        />
        <Tooltip>Dataset Version History</Tooltip>
      </TooltipTrigger>
      <Suspense fallback={null}>
        <DialogContainer
          type="modal"
          isDismissable
          onDismiss={() => {
            setDialog(null);
          }}
        >
          {dialog}
        </DialogContainer>
      </Suspense>
    </>
  );
}
