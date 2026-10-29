import { Divider, Select, Stack, TextInput, Text } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { StirlingFile } from "@editor/types/fileContext";
import { PDFDocument } from "@cantoo/pdf-lib";
import { thumbnailGenerationService } from "@editor/services/thumbnailGenerationService";
import { useTranslation } from "react-i18next";
import { ReorganizePagesParameters } from "@editor/hooks/tools/reorganizePages/useReorganizePagesParameters";
import { getReorganizePagesModeData } from "@editor/components/tools/reorganizePages/constants";
import { Z_INDEX_AUTOMATE_DROPDOWN } from "@editor/styles/zIndex";

export default function ReorganizePagesSettings({
  parameters,
  onParameterChange,
  disabled,
  file,
}: {
  parameters: ReorganizePagesParameters;
  onParameterChange: <K extends keyof ReorganizePagesParameters>(
    key: K,
    value: ReorganizePagesParameters[K],
  ) => void;
  disabled?: boolean;
  file?: StirlingFile;
}) {
  const { t } = useTranslation();
  const modeData = getReorganizePagesModeData(t);
  const [pages, setPages] = useState<number[]>([]);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const dragging = useRef<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setPreviews({});
    if (!file) return () => { cancelled = true; };
    void (async () => {
      try {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const numbers = Array.from({ length: pdf.getPageCount() }, (_, i) => i + 1);
        if (cancelled) return;
        setPages(numbers);
        onParameterChange("pageNumbers", numbers.join(","));
        const thumbnails = await thumbnailGenerationService.generateThumbnails(
          file.fileId, bytes, numbers, { scale: 0.16, quality: 0.7 },
          progress => {
            if (!cancelled) setPreviews(old => ({
              ...old,
              ...Object.fromEntries(progress.thumbnails.map(item => [item.pageNumber, item.thumbnail])),
            }));
          },
        );
        if (!cancelled) setPreviews(Object.fromEntries(
          thumbnails.filter(item => item.success).map(item => [item.pageNumber, item.thumbnail]),
        ));
      } catch (error) {
        if (!cancelled) setPreviewError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => { cancelled = true; };
  }, [file?.fileId]);
  const movePage = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return;
    const next = pages.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPages(next);
    onParameterChange("pageNumbers", next.join(","));
  };


  const requiresOrder =
    parameters.customMode === "" || parameters.customMode === "DUPLICATE";
  const selectedMode =
    modeData.find((mode) => mode.value === parameters.customMode) ||
    modeData[0];
  return (
    <Stack gap="sm">
      <Select
        label={t("pdfOrganiser.mode._value", "Organization mode")}
        data={modeData}
        value={parameters.customMode}
        onChange={(v) => onParameterChange("customMode", v ?? "")}
        disabled={disabled}
        comboboxProps={{
          withinPortal: true,
          zIndex: Z_INDEX_AUTOMATE_DROPDOWN,
        }}
      />
      {selectedMode && (
        <div
          style={{
            backgroundColor: "var(--c-surface)",
            color: "var(--information-text-color)",
            padding: "8px 12px",
            borderRadius: "8px",
            marginTop: "4px",
            fontSize: "0.75rem",
            textAlign: "center",
          }}
        >
          {selectedMode.description}
        </div>
      )}

      {requiresOrder && (
        <>
          <Divider />
          {parameters.customMode === "" && pages.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" fw={600}>Arraste as miniaturas para reorganizar as páginas</Text>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8, maxHeight: 410, overflowY: "auto" }}>
                {pages.map((page, index) => (
                  <div key={page} draggable={!disabled}
                    onDragStart={event => {
                      dragging.current = index;
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(page));
                    }}
                    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                    onDrop={event => {
                      event.preventDefault();
                      if (dragging.current !== null) movePage(dragging.current, index);
                      dragging.current = null;
                    }}
                    onDragEnd={() => { dragging.current = null; }}
                    aria-label={`Página ${page}, posição ${index + 1}`}
                    style={{ padding: 7, border: "1px solid var(--c-border-subtle)",
                      borderRadius: 6, cursor: disabled ? "default" : "grab",
                      textAlign: "center", background: "var(--c-surface)" }}>
                    {previews[page]
                      ? <img src={previews[page]} alt={`Miniatura da página ${page}`}
                          style={{ width: "100%", height: 115, objectFit: "contain" }} />
                      : <div style={{ height: 115, display: "grid", placeItems: "center" }}>Página {page}</div>}
                    <Text size="xs">{`Página ${page} · posição ${index + 1}`}</Text>
                    <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                      <button type="button" disabled={disabled || index === 0}
                        onClick={() => movePage(index, index - 1)} aria-label={`Mover página ${page} para trás`}>←</button>
                      <button type="button" disabled={disabled || index === pages.length - 1}
                        onClick={() => movePage(index, index + 1)} aria-label={`Mover página ${page} para frente`}>→</button>
                    </div>
                  </div>
                ))}
              </div>
            </Stack>
          )}
          {previewError && <Text size="xs" c="red">{previewError}</Text>}
          <TextInput
            label={t("pageOrderPrompt", "Page order / ranges")}
            placeholder={t("pdfOrganiser.placeholder", "e.g. 1,3,2,4-6")}
            value={parameters.pageNumbers}
            onChange={(e) =>
              onParameterChange("pageNumbers", e.currentTarget.value)
            }
            disabled={disabled}
          />
        </>
      )}
    </Stack>
  );
}
