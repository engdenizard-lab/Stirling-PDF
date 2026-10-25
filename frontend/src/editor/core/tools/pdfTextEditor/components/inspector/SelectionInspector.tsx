import { useMemo, useRef, useState } from "react";
import { ImageCropDialog } from "@editor/tools/pdfTextEditor/components/ImageCropDialog";
import { Group, NumberInput, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Button } from "@editor/ui/Button";
import { Icon } from "@editor/ui/Icon";
import {
  Field,
  PointsInput,
  Section,
  SectionLabel,
} from "@editor/tools/pdfTextEditor/components/inspector/InspectorPrimitives";
import type { SelectionGeometry } from "@editor/tools/pdfTextEditor/hooks/useSelectionGeometry";
import type { useToolbarController } from "@editor/tools/pdfTextEditor/hooks/useToolbarController";
import type { SelectionState } from "@editor/tools/pdfTextEditor/types";
import { modShortcut } from "@editor/utils/hotkeys";

export type InspectorController = ReturnType<typeof useToolbarController>;

interface Props {
  controller: InspectorController;
  selection: SelectionState;
  geometry: SelectionGeometry;
  /** Font status for the selected runs, e.g. "Embedded · full alphabet". */
  fontNote: string | null;
  canGroup: boolean;
  canUngroup: boolean;
  onGroup: () => void;
  onUngroup: () => void;
}

/**
 * Properties of whatever is selected right now.
 *
 * Deliberately NOT the whole of the selection's UI: character formatting and
 * the arrange/lock/delete verbs sit in the canvas toolbar, where document
 * editors have always put them. What lands here is what needs a label and a
 * number - geometry and paragraph structure.
 */
export function SelectionInspector({
  controller,
  selection,
  geometry,
  fontNote,
  canGroup,
  canUngroup,
  onGroup,
  onUngroup,
}: Props) {
  const runCount = selection.runIds.length;
  const imageCount = selection.imageIds.length;
  const shapeCount = selection.shapeIds.length;
  const { hasRunSelection, hasImageSelection } = controller;

  return (
    <Stack gap={0} data-testid="pdf-editor-selection-inspector">
      <SelectionHeader
        runCount={runCount}
        imageCount={imageCount}
        shapeCount={shapeCount}
        fontNote={hasRunSelection ? fontNote : null}
      />
      {runCount + imageCount > 0 && (
        <GeometrySection geometry={geometry} isImage={!hasRunSelection} />
      )}
      {hasRunSelection && <AdvancedTextSection key={selection.runIds.join(":")} controller={controller} />}
      {hasRunSelection && (
        <ParagraphSection
          canGroup={canGroup}
          canUngroup={canUngroup}
          onGroup={onGroup}
          onUngroup={onUngroup}
        />
      )}
      {hasImageSelection && <ImageSection key={selection.imageIds.join(":")} controller={controller} />}
    </Stack>
  );
}

/** Names what is selected, and how its font will treat new characters. */
function SelectionHeader({
  runCount,
  imageCount,
  shapeCount,
  fontNote,
}: {
  runCount: number;
  imageCount: number;
  shapeCount: number;
  fontNote: string | null;
}) {
  const { t } = useTranslation();
  const kinds = [runCount, imageCount, shapeCount].filter((n) => n > 0).length;
  let title: string;
  if (kinds > 1) {
    title = t("pdfTextEditor.inspector.mixed", "{{count}} objects", {
      count: runCount + imageCount + shapeCount,
    });
  } else if (shapeCount > 0) {
    title =
      shapeCount === 1
        ? t("pdfTextEditor.inspector.oneShape", "Shape")
        : t("pdfTextEditor.inspector.manyShapes", "{{count}} shapes", {
            count: shapeCount,
          });
  } else if (runCount > 0) {
    title =
      runCount === 1
        ? t("pdfTextEditor.inspector.oneText", "Text")
        : t("pdfTextEditor.inspector.manyText", "Text · {{count}} boxes", {
            count: runCount,
          });
  } else {
    title =
      imageCount === 1
        ? t("pdfTextEditor.inspector.oneImage", "Image")
        : t("pdfTextEditor.inspector.manyImages", "{{count}} images", {
            count: imageCount,
          });
  }
  return (
    <Section tinted first>
      {/* Doubles as the old sidebar's selection readout, moved from the very
          bottom of the panel to the top where the user is already looking. */}
      <Text size="sm" fw={600} data-testid="pdf-editor-selection-count">
        {title}
      </Text>
      {fontNote && (
        <Text
          size="xs"
          c="dimmed"
          mt={4}
          data-testid="pdf-editor-inspector-font-note"
        >
          {fontNote}
        </Text>
      )}
    </Section>
  );
}

/** Numeric and typographic controls reuse the existing undoable text commands. */
function AdvancedTextSection({ controller }: { controller: InspectorController }) {
  const { t } = useTranslation();
  const state = controller.state;
  const [family, setFamily] = useState(state.fontFamily ?? "");
  const [size, setSize] = useState<number | string>(state.fontSize ?? "");
  const fill = state.fill;
  const currentColour = fill
    ? "#" + [fill.r, fill.g, fill.b].map((n) => n.toString(16).padStart(2, "0")).join("")
    : "";
  const [colour, setColour] = useState(currentColour);
  const [outlineWidth, setOutlineWidth] = useState<number | string>(state.strokeWidth ?? 0);
  const [outlineColour, setOutlineColour] = useState("#000000");
  const validHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <Section testId="pdf-editor-advanced-text">
      <SectionLabel>{t("pdfTextEditor.inspector.advancedText", "Edição avançada de texto")}</SectionLabel>
      <Stack gap="xs">
        <TextInput
          label={t("pdfTextEditor.inspector.fontFamily", "Fonte")}
          description={t("pdfTextEditor.inspector.fontFamilyHelp", "Nome da fonte disponível ou incorporada")}
          value={family}
          onChange={(event) => setFamily(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && family.trim()) {
              controller.onChangeFontFamily(family.trim());
              event.currentTarget.blur();
            }
          }}
          data-testid="pdf-editor-advanced-font-family"
        />
        <Group grow gap="xs" align="end">
          <NumberInput
            label={t("pdfTextEditor.inspector.fontSize", "Tamanho (pt)")}
            value={size}
            min={1}
            max={500}
            step={1}
            onChange={setSize}
            onBlur={() => {
              if (typeof size === "number" && Number.isFinite(size) && size >= 1 && size <= 500)
                controller.onChangeFontSize(size);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            data-testid="pdf-editor-advanced-font-size"
          />
          <TextInput
            label={t("pdfTextEditor.inspector.textColour", "Cor hexadecimal")}
            placeholder="#000000"
            value={colour}
            onChange={(event) => setColour(event.currentTarget.value)}
            onBlur={() => { if (validHex(colour)) controller.onChangeFill(colour); }}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            data-testid="pdf-editor-advanced-text-colour"
          />
        </Group>
        <Group grow gap="xs" align="end">
          <TextInput
            label={t("pdfTextEditor.inspector.outlineColour", "Cor do contorno")}
            value={outlineColour}
            onChange={(event) => setOutlineColour(event.currentTarget.value)}
            data-testid="pdf-editor-advanced-outline-colour"
          />
          <NumberInput
            label={t("pdfTextEditor.inspector.outlineWidth", "Contorno (pt)")}
            value={outlineWidth}
            onChange={setOutlineWidth}
            min={0}
            max={20}
            step={0.5}
            decimalScale={2}
            data-testid="pdf-editor-advanced-outline-width"
          />
        </Group>
        <Button size="sm" variant="secondary" accent="neutral" fullWidth
          disabled={!validHex(outlineColour) || typeof outlineWidth !== "number"}
          onClick={() => {
            if (typeof outlineWidth === "number" && Number.isFinite(outlineWidth))
              controller.onChangeOutline(outlineWidth === 0 ? null : outlineColour, outlineWidth);
          }}
          data-testid="pdf-editor-advanced-outline-apply">
          {t("pdfTextEditor.inspector.applyOutline", "Aplicar contorno")}
        </Button>
        <Text size="xs" c="dimmed">{t("pdfTextEditor.inspector.caseChange", "Converter texto")}</Text>
        <Group gap="xs" grow>
          <Button size="sm" variant="secondary" accent="neutral" onClick={() => controller.onChangeCase("upper")}>
            {t("pdfTextEditor.inspector.uppercase", "MAIÚSCULAS")}
          </Button>
          <Button size="sm" variant="secondary" accent="neutral" onClick={() => controller.onChangeCase("lower")}>
            {t("pdfTextEditor.inspector.lowercase", "minúsculas")}
          </Button>
        </Group>
        <Group gap="xs" grow>
          <Button size="sm" variant="secondary" accent="neutral" onClick={() => controller.onAlign("left")}>
            {t("pdfTextEditor.inspector.alignLeft", "Esquerda")}
          </Button>
          <Button size="sm" variant="secondary" accent="neutral" onClick={() => controller.onAlign("center-h")}>
            {t("pdfTextEditor.inspector.alignCenter", "Centro")}
          </Button>
          <Button size="sm" variant="secondary" accent="neutral" onClick={() => controller.onAlign("right")}>
            {t("pdfTextEditor.inspector.alignRight", "Direita")}
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          {t("pdfTextEditor.inspector.alignHelp", "O alinhamento interno requer um parágrafo com múltiplas linhas; para vários objetos, alinha as caixas selecionadas.")}
        </Text>
      </Stack>
    </Section>
  );
}

/** Merge selected runs into a paragraph, or split one back into lines. */
function ParagraphSection({
  canGroup,
  canUngroup,
  onGroup,
  onUngroup,
}: {
  canGroup: boolean;
  canUngroup: boolean;
  onGroup: () => void;
  onUngroup: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Section testId="pdf-editor-paragraph-section">
      <SectionLabel>
        {t("pdfTextEditor.sidebar.paragraph", "Paragraph")}
      </SectionLabel>
      <Group grow gap="xs" wrap="nowrap">
        <Tooltip
          label={
            canGroup
              ? t("pdfTextEditor.sidebar.groupTooltip", {
                  defaultValue:
                    "Merge selected runs into one paragraph ({{shortcut}})",
                  shortcut: modShortcut("M"),
                })
              : t(
                  "pdfTextEditor.sidebar.groupTooltipDisabled",
                  "Select 2+ runs to merge",
                )
          }
        >
          <Button
            size="sm"
            variant="secondary"
            accent="neutral"
            leftSection={<Icon name="merge" size={20} />}
            onClick={onGroup}
            disabled={!canGroup}
            data-testid="pdf-editor-group"
          >
            {t("pdfTextEditor.sidebar.group", "Group")}
          </Button>
        </Tooltip>
        <Tooltip
          label={
            canUngroup
              ? t(
                  "pdfTextEditor.sidebar.ungroupTooltip",
                  "Split this paragraph into one run per line",
                )
              : t(
                  "pdfTextEditor.sidebar.ungroupTooltipDisabled",
                  "Select a multi-line paragraph to ungroup",
                )
          }
        >
          <Button
            size="sm"
            variant="secondary"
            accent="neutral"
            leftSection={<Icon name="split" size={20} />}
            onClick={onUngroup}
            disabled={!canUngroup}
            data-testid="pdf-editor-ungroup"
          >
            {t("pdfTextEditor.sidebar.ungroup", "Ungroup")}
          </Button>
        </Tooltip>
      </Group>
    </Section>
  );
}

/** Position and size, in PDF points, for a single selected object. */
function GeometrySection({
  geometry,
  isImage,
}: {
  geometry: SelectionGeometry;
  isImage: boolean;
}) {
  const { t } = useTranslation();
  if (!geometry.single) {
    return (
      <Section>
        <SectionLabel>
          {t("pdfTextEditor.inspector.geometry", "Position & size")}
        </SectionLabel>
        <Text size="xs" c="dimmed">
          {t(
            "pdfTextEditor.inspector.multiGeometry",
            "Select a single object to edit its position and size.",
          )}
        </Text>
      </Section>
    );
  }
  const { bounds, setX, setY, setWidth, setHeight } = geometry.single;
  return (
    <Section testId="pdf-editor-geometry-section">
      <SectionLabel>
        {t("pdfTextEditor.inspector.geometry", "Position & size")}
      </SectionLabel>
      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap" align="flex-end">
          <Field label={t("pdfTextEditor.inspector.x", "X")}>
            <PointsInput
              value={bounds.x}
              onCommit={setX}
              label={t("pdfTextEditor.inspector.x", "X")}
              testId="pdf-editor-pos-x"
            />
          </Field>
          <Field label={t("pdfTextEditor.inspector.y", "Y")}>
            <PointsInput
              value={bounds.y}
              onCommit={setY}
              label={t("pdfTextEditor.inspector.y", "Y")}
              testId="pdf-editor-pos-y"
            />
          </Field>
        </Group>
        <Group gap="xs" wrap="nowrap" align="flex-end">
          <Field
            label={t("pdfTextEditor.inspector.width", "Width")}
            hint={
              isImage
                ? undefined
                : t(
                    "pdfTextEditor.inspector.widthHint",
                    "Text re-wraps to fit the width.",
                  )
            }
          >
            <PointsInput
              value={bounds.width}
              onCommit={setWidth}
              min={1}
              label={t("pdfTextEditor.inspector.width", "Width")}
              testId="pdf-editor-size-w"
            />
          </Field>
          <Field
            label={t("pdfTextEditor.inspector.height", "Height")}
            hint={
              setHeight
                ? undefined
                : t(
                    "pdfTextEditor.inspector.heightHint",
                    "A text box's height follows its type size and line count.",
                  )
            }
          >
            <PointsInput
              value={bounds.height}
              onCommit={setHeight ?? (() => undefined)}
              min={1}
              disabled={!setHeight}
              label={t("pdfTextEditor.inspector.height", "Height")}
              testId="pdf-editor-size-h"
            />
          </Field>
        </Group>
      </Stack>
    </Section>
  );
}

/** Rotate/flip plus the two ways to swap an image's pixels. */
function ImageSection({ controller }: { controller: InspectorController }) {
  const { t } = useTranslation();
  const {
    onTransformImage,
    onRotateImageByAngle,
    onReplaceImage,
    onCropImage,
    cropPixels,
    onApplyImageCrop,
    onCancelImageCrop,
    onEditImageExternally,
    externalEditSupported,
  } = controller;
  // Value is relative to the image's orientation when it was selected.
  // Dispatch every valid change immediately: clicking elsewhere must not be
  // necessary to make the PDF update. A ref keeps rapid +/-1 steps accurate.
  const [angle, setAngle] = useState<number | string>(0);
  const appliedAngle = useRef(0);
  const updateAngle = (next: number | string) => {
    setAngle(next);
    if (typeof next !== "number" || !Number.isFinite(next)) return;
    const delta = next - appliedAngle.current;
    if (delta === 0) return;
    appliedAngle.current = next;
    onRotateImageByAngle(delta);
  };
  const transforms = useMemo(
    () =>
      [
        {
          mode: "rotate-ccw" as const,
          testId: "pdf-editor-imgop-rotate-ccw",
          icon: <Icon name="rotate-ccw" size={20} />,
          label: t("pdfTextEditor.toolbar.rotateLeft", "Rotate 90° left"),
        },
        {
          mode: "rotate-cw" as const,
          testId: "pdf-editor-imgop-rotate-cw",
          icon: <Icon name="rotate-cw" size={20} />,
          label: t("pdfTextEditor.toolbar.rotateRight", "Rotate 90° right"),
        },
        {
          mode: "flip-h" as const,
          testId: "pdf-editor-imgop-flip-h",
          icon: <Icon name="flip-horizontal-2" size={20} />,
          label: t("pdfTextEditor.toolbar.flipHorizontal", "Flip horizontal"),
        },
        {
          mode: "flip-v" as const,
          testId: "pdf-editor-imgop-flip-v",
          icon: (
            <Icon
              name="flip-horizontal-2"
              size={20}
              style={{ transform: "rotate(90deg)" }}
            />
          ),
          label: t("pdfTextEditor.toolbar.flipVertical", "Flip vertical"),
        },
      ] as const,
    [t],
  );

  return (
    <Section testId="pdf-editor-imgop-menu">
      <SectionLabel>{t("pdfTextEditor.inspector.image", "Image")}</SectionLabel>
      <Stack gap="xs">
        <NumberInput
          label={t("pdfTextEditor.inspector.imageRotationAngle", "Rotação (°)")}
          description={t("pdfTextEditor.inspector.imageRotationHint", "A rotação é aplicada automaticamente; use as setas para ajustar 1° por vez.")}
          value={angle}
          onChange={updateAngle}
          step={1}
          decimalScale={2}
          allowNegative
          suffix="°"
          data-testid="pdf-editor-imgop-rotate-angle"
        />
        <Group gap={4} wrap="nowrap">
          {transforms.map((tr) => (
            <Tooltip key={tr.mode} label={tr.label}>
              <Button
                size="sm"
                variant="secondary"
                accent="neutral"
                aria-label={tr.label}
                data-testid={tr.testId}
                onClick={() => onTransformImage(tr.mode)}
                leftSection={tr.icon}
              />
            </Tooltip>
          ))}
        </Group>
        <Button size="sm" variant="secondary" accent="neutral" fullWidth justify="start"
          leftSection={<Icon name="crop" size={20} />}
          onClick={onCropImage} data-testid="pdf-editor-imgop-crop">
          {t("pdfTextEditor.toolbar.cropImage", "Recortar imagem")}
        </Button>
        {cropPixels && <ImageCropDialog pixels={cropPixels} onApply={onApplyImageCrop} onClose={onCancelImageCrop} />}
        <Button
          size="sm"
          variant="secondary"
          accent="neutral"
          fullWidth
          justify="start"
          leftSection={<Icon name="image" size={20} />}
          onClick={onReplaceImage}
          data-testid="pdf-editor-imgop-replace"
        >
          {t(
            "pdfTextEditor.toolbar.replaceImage",
            "Replace, keeping placement",
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          accent="neutral"
          fullWidth
          justify="start"
          leftSection={<Icon name="external-link" size={20} />}
          onClick={onEditImageExternally}
          disabled={!externalEditSupported}
          data-testid="pdf-editor-imgop-edit-externally"
        >
          {t(
            "pdfTextEditor.toolbar.editImageExternally",
            "Edit in another app",
          )}
        </Button>
      </Stack>
    </Section>
  );
}
