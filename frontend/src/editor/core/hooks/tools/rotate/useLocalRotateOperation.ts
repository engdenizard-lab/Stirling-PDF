import { defineCustomTool, useToolOperation } from "@editor/hooks/tools/shared/useToolOperation";
import { rotatePagesLocally } from "@editor/utils/localPdfPages";
import { validateRotateParameters, type RotateParameters } from "@editor/hooks/tools/rotate/useRotateParameters";

export const localRotateConfig = defineCustomTool<RotateParameters>({
  operationType: "rotate",
  validateParams: validateRotateParameters,
  customProcessor: async (parameters, files) => {
    const outputs: File[] = [];
    for (const file of files) {
      const bytes = await rotatePagesLocally(new Uint8Array(await file.arrayBuffer()), parameters.angle);
      const name = file.name.replace(/\.pdf$/i, "") + "_girado.pdf";
      outputs.push(new File([new Uint8Array(bytes)], name, { type: "application/pdf" }));
    }
    return { files: outputs };
  },
});

export const useLocalRotateOperation = () => useToolOperation(localRotateConfig);
