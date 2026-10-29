import { useToolOperation, defineCustomTool } from "@editor/hooks/tools/shared/useToolOperation";
import { reorderPagesLocally, validatePageOrder } from "@editor/utils/localPdfPages";
import type { ReorganizePagesParameters } from "@editor/hooks/tools/reorganizePages/useReorganizePagesParameters";
import { PDFDocument } from "@cantoo/pdf-lib";

export const localReorganizeConfig = defineCustomTool<ReorganizePagesParameters>({
  operationType: "reorganizePages",
  validateParams: (params) => params.customMode === "" && params.pageNumbers.trim().length > 0,
  customProcessor: async (params, files) => {
    const outputs: File[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await PDFDocument.load(bytes);
      const order = params.pageNumbers.split(",").map(value => Number(value.trim()));
      validatePageOrder(order, pdf.getPageCount());
      const processed = await reorderPagesLocally(bytes, order);
      outputs.push(new File([new Uint8Array(processed)], file.name.replace(/\.pdf$/i, "") + "_reorganizado.pdf", { type: "application/pdf" }));
    }
    return { files: outputs };
  },
});
export const useLocalReorganizePagesOperation = () => useToolOperation(localReorganizeConfig);
