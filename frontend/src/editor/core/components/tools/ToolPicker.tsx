import React, { useMemo, useRef, useState } from "react";
import { Box, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Button } from "@editor/ui/Button";
import { ToolRegistryEntry } from "@editor/data/toolsTaxonomy";
import "@editor/components/tools/toolPicker/ToolPicker.css";
import { useToolSections } from "@editor/hooks/useToolSections";
import type { SubcategoryGroup } from "@editor/hooks/useToolSections";
import { useFavoriteToolItems } from "@editor/hooks/tools/useFavoriteToolItems";
import NoToolsFound from "@editor/components/tools/shared/NoToolsFound";
import { renderToolButtons } from "@editor/components/tools/shared/renderToolButtons";
import ToolButton from "@editor/components/tools/toolPicker/ToolButton";
import { LazyToolSection } from "@editor/components/tools/toolPicker/LazyToolSection";
import { useToolWorkflowData } from "@editor/contexts/ToolWorkflowContext";
import { useIsScrolled } from "@editor/hooks/useIsScrolled";
import { ToolId } from "@editor/types/toolId";
import { getSubcategoryLabel } from "@editor/data/toolsTaxonomy";
import { ToolPickerFooterExtensions } from "@editor/components/tools/toolPicker/ToolPickerFooterExtensions";

interface ToolPickerProps {
  selectedToolKey: string | null;
  onSelect: (id: string) => void;
  filteredTools: Array<{
    item: [ToolId, ToolRegistryEntry];
    matchedText?: string;
  }>;
  isSearching?: boolean;
  /** Compact "resting" view: favourites + recommended only, with a button to expand. */
  compact?: boolean;
  /** Called when the user clicks "View all tools" in compact mode. */
  onShowAllTools?: () => void;
  /** Pinned above the list; gains a rule once rows scroll beneath it. */
  header?: React.ReactNode;
}

const EMPTY_FILTERED_TOOLS: ToolPickerProps["filteredTools"] = [];
const HEADER_TEXT_STYLE: React.CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 600,
  padding: "0.25rem 0 0.35rem 0.5rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--c-text-subtle)",
};
const SCROLLABLE_STYLE: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  minHeight: 0,
  height: "100%",
  marginTop: -2,
};
const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--c-surface)",
};
const toTitleCase = (s: string) =>
  s.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase(),
  );

/** Each category remembers its expanded state without changing tool selection. */
function CollapsibleToolGroup({
  id, label, defaultOpen = false, children,
}: {
  id: string; label: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const key = `stirling-crop:tool-group:${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? defaultOpen : stored === "true";
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { window.localStorage.setItem(key, String(next)); } catch { /* storage disabled */ }
  };
  return (
    <Box w="100%">
      <button type="button" onClick={toggle} aria-expanded={open}
        aria-label={`${open ? "Recolher" : "Expandir"}: ${label}`}
        style={{ ...HEADER_TEXT_STYLE, width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", background: "transparent", border: 0,
          cursor: "pointer", textAlign: "left" }}>
        <span>{label}</span><span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div>{children}</div>}
    </Box>
  );
}

const ToolPicker = ({
  selectedToolKey,
  onSelect,
  filteredTools,
  isSearching = false,
  compact = false,
  onShowAllTools,
  header,
}: ToolPickerProps) => {
  const { t } = useTranslation();

  const { scrolled, scrollRef } = useIsScrolled();
  // The lazy sections observe against the scroller itself, so they need a
  // stable ref alongside the callback ref that drives the header divider.
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const { sections: visibleSections } = useToolSections(filteredTools);
  const { favoriteTools, toolRegistry } = useToolWorkflowData();

  const favoriteToolItems = useFavoriteToolItems(favoriteTools, toolRegistry);

  const quickSection = useMemo(
    () => visibleSections.find((s) => s.key === "quick"),
    [visibleSections],
  );

  const recommendedItems = useMemo(() => {
    const items: Array<{ id: string; tool: ToolRegistryEntry }> = [];
    quickSection?.subcategories.forEach((sc: SubcategoryGroup) =>
      sc.tools.forEach((toolEntry) => items.push(toolEntry)),
    );
    return items;
  }, [quickSection]);

  const allSection = useMemo(
    () => visibleSections.find((s) => s.key === "all"),
    [visibleSections],
  );

  // Build flat list by subcategory for search mode
  const effectiveFilteredForSearch: ToolPickerProps["filteredTools"] =
    isSearching ? filteredTools : EMPTY_FILTERED_TOOLS;
  const { searchGroups } = useToolSections(effectiveFilteredForSearch);

  return (
    <Box h="100%" style={CONTAINER_STYLE}>
      {header && (
        <div
          className="tool-picker__header"
          data-scrolled={scrolled || undefined}
        >
          {header}
        </div>
      )}
      <Box
        ref={(el: HTMLDivElement | null) => {
          scrollerRef.current = el;
          return scrollRef(el);
        }}
        style={SCROLLABLE_STYLE}
        className="tool-picker-scrollable"
      >
        {isSearching ? (
          <Stack p="sm" gap="xs">
            {searchGroups.length === 0 ? (
              <NoToolsFound />
            ) : (
              searchGroups.map((group) =>
                renderToolButtons(
                  t,
                  group,
                  selectedToolKey,
                  onSelect,
                  true,
                  false,
                  filteredTools,
                  true,
                ),
              )
            )}
          </Stack>
        ) : compact ? (
          /* Resting state: flat list of pinned + recommended only. */
          <Box className="tool-picker__compact">
            <div style={HEADER_TEXT_STYLE}>
              {t("toolPanel.toolsHeader", "PDF Tools")}
            </div>
            {favoriteToolItems.length === 0 && recommendedItems.length === 0 ? (
              <NoToolsFound />
            ) : (
              <div className="tool-picker__compact-list">
                {favoriteToolItems.map(({ id, tool }) => (
                  <ToolButton
                    key={`fav-${id}`}
                    id={id}
                    tool={tool}
                    isSelected={selectedToolKey === id}
                    onSelect={onSelect}
                    hasStars
                    showDescription
                  />
                ))}
                {recommendedItems
                  .filter(
                    ({ id }) => !favoriteToolItems.some((fav) => fav.id === id),
                  )
                  .map(({ id, tool }) => (
                    <ToolButton
                      key={`rec-${id}`}
                      id={id as ToolId}
                      tool={tool}
                      isSelected={selectedToolKey === id}
                      onSelect={onSelect}
                      hasStars
                      showDescription
                    />
                  ))}
              </div>
            )}
            {onShowAllTools && (
              <Button
                variant="tertiary"
                size="sm"
                fullWidth
                onClick={onShowAllTools}
                className="tool-picker__view-all"
                aria-label={t("toolPanel.viewAllTools", "View all tools")}
              >
                {t("toolPanel.viewAllTools", "View all tools")}
              </Button>
            )}
          </Box>
        ) : (
          <>
            {/* All-tools view: favourites + recommended + all subcategories. */}
            <Stack px="sm" pb="sm" pt={4} gap="xs">
              {favoriteToolItems.length > 0 && (
                <CollapsibleToolGroup id="favorites" label={t("toolPanel.fullscreen.favorites", "Favourites")} defaultOpen>
                    {favoriteToolItems.map(({ id, tool }) => (
                      <ToolButton
                        key={`fav-${id}`}
                        id={id}
                        tool={tool}
                        isSelected={selectedToolKey === id}
                        onSelect={onSelect}
                        hasStars
                      />
                    ))}
                </CollapsibleToolGroup>
              )}
              {recommendedItems.length > 0 && (
                <CollapsibleToolGroup id="recommended" label={t("toolPanel.fullscreen.recommended", "Recommended")}>
                    {recommendedItems.map(({ id, tool }) => (
                      <ToolButton
                        key={`rec-${id}`}
                        id={id as ToolId}
                        tool={tool}
                        isSelected={selectedToolKey === id}
                        onSelect={onSelect}
                        hasStars
                      />
                    ))}
                </CollapsibleToolGroup>
              )}
              {allSection &&
                allSection.subcategories.map((sc: SubcategoryGroup) => (
                  <LazyToolSection
                    key={sc.subcategoryId}
                    estimatedHeight={32 + sc.tools.length * 44}
                    scrollRoot={scrollerRef}
                    label={toTitleCase(
                      getSubcategoryLabel(t, sc.subcategoryId),
                    )}
                  >
                    <CollapsibleToolGroup id={String(sc.subcategoryId)} label={toTitleCase(getSubcategoryLabel(t, sc.subcategoryId))}>
                      {renderToolButtons(
                        t,
                        sc,
                        selectedToolKey,
                        onSelect,
                        false,
                        false,
                        undefined,
                        true,
                      )}
                    </CollapsibleToolGroup>
                  </LazyToolSection>
                ))}
            </Stack>

            {!quickSection && !allSection && <NoToolsFound />}

            <div aria-hidden style={{ height: 200 }} />
          </>
        )}
      </Box>
      <ToolPickerFooterExtensions />
    </Box>
  );
};

export default ToolPicker;
