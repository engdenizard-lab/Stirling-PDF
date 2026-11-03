import { useEffect, useState } from "react";
import { Group, NumberInput, Tooltip } from "@mantine/core";
import { Icon } from "@editor/ui/Icon";
import { Button } from "@editor/ui/Button";

/**
 * The editor owns a separate scroll area from the PDF viewer. Track its
 * visible page and expose the same first/previous/page/next/last navigation.
 * Page numbers presented to users are 1-based; editor indices are 0-based.
 */
export function EditorPageNavigation({ pageCount }: { pageCount: number }) {
  const [page, setPage] = useState(1);
  const [typed, setTyped] = useState<number | string>(1);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="pdf-editor-stage"]');
    const stage = root?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport], .mantine-ScrollArea-viewport") ?? root;
    if (!stage || pageCount < 1) return;
    let raf = 0;
    const update = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const viewportMid = stage.getBoundingClientRect().top + stage.clientHeight / 2;
        let current = 1;
        let distance = Number.POSITIVE_INFINITY;
        const pages = root?.querySelectorAll<HTMLElement>('[data-testid^="pdf-editor-page-"]') ?? [];
        pages.forEach(el => {
          const id = el.dataset.testid ?? "";
          const match = /^pdf-editor-page-(\\d+)$/.exec(id);
          if (!match) return;
          const rect = el.getBoundingClientRect();
          const delta = Math.abs((rect.top + rect.bottom) / 2 - viewportMid);
          if (delta < distance) {
            distance = delta;
            current = Math.max(1, Math.min(pageCount, Number(match[1]) + 1));
          }
        });
        setPage(current);
        setTyped(current);
      });
    };
    update();
    stage.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      stage.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.cancelAnimationFrame(raf);
    };
  }, [pageCount]);

  const goTo = (candidate: number) => {
    if (!Number.isFinite(candidate) || pageCount < 1) return;
    const next = Math.max(1, Math.min(pageCount, Math.trunc(candidate)));
    const target = document.querySelector<HTMLElement>(
      `[data-testid="pdf-editor-page-${next - 1}"]`,
    );
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setPage(next);
    setTyped(next);
  };

  return (
    <Group gap={4} justify="center" wrap="nowrap" py={4}
      data-testid="pdf-editor-page-navigation" aria-label="Navegação entre páginas do PDF">
      <Tooltip label="Primeira página"><Button size="sm" variant="tertiary" accent="neutral"
        disabled={page <= 1} onClick={() => goTo(1)} aria-label="Primeira página"
        leftSection={<Icon name="chevrons-left" size={18} />} /></Tooltip>
      <Tooltip label="Página anterior"><Button size="sm" variant="tertiary" accent="neutral"
        disabled={page <= 1} onClick={() => goTo(page - 1)} aria-label="Página anterior"
        leftSection={<Icon name="chevron-left" size={18} />} /></Tooltip>
      <NumberInput size="xs" min={1} max={pageCount} allowDecimal={false}
        allowNegative={false} hideControls value={typed} w={62}
        aria-label="Número da página atual"
        onChange={setTyped}
        onBlur={() => goTo(Number(typed) || page)}
        onKeyDown={event => { if (event.key === "Enter") goTo(Number(typed) || page); }} />
      <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>/ {pageCount}</span>
      <Tooltip label="Próxima página"><Button size="sm" variant="tertiary" accent="neutral"
        disabled={page >= pageCount} onClick={() => goTo(page + 1)} aria-label="Próxima página"
        leftSection={<Icon name="chevron-right" size={18} />} /></Tooltip>
      <Tooltip label="Última página"><Button size="sm" variant="tertiary" accent="neutral"
        disabled={page >= pageCount} onClick={() => goTo(pageCount)} aria-label="Última página"
        leftSection={<Icon name="chevrons-right" size={18} />} /></Tooltip>
    </Group>
  );
}
