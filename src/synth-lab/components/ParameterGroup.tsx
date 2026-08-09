"use client";

import { useId, type ReactNode } from "react";
import styles from "@/synth-lab/styles.module.css";

export interface ParameterGroupProps {
  /** Group title (Figma header, left). */
  title: string;
  /** Optional contextual/technical line under the title. */
  technical?: string | null;
  /** Chip copy while expanded — Figma uses "ESSENTIALS". */
  chip: string;
  /**
   * Names of the controls this group holds. Shown while collapsed, and its
   * length is the collapsed chip's count ("3 MORE"), so a collapsed group
   * still says what is inside it.
   */
  summary: string[];
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  /** Lesson (cyan) or agent (magenta) treatment, mirroring Parameter Slider. */
  highlight?: "lesson" | "agent" | null;
  /** Controls shown whenever the group is expanded. */
  children: ReactNode;
  /** Secondary controls behind the group's own "+ More" line. */
  more?: ReactNode;
  /** "+ More · …" copy naming what is still hidden. */
  moreLabel?: string | null;
  moreOpen?: boolean;
  onToggleMore?: (open: boolean) => void;
}

/**
 * Parameter Group (Figma 27:104). Progressive disclosure inside the track
 * editor: essentials expanded, secondary parameters behind More. Two levels,
 * exactly as the component draws them — the group collapses to its header plus
 * a summary of its contents, and an expanded group can still hold a "+ More"
 * tier.
 *
 * Both disclosures are plain buttons with `aria-expanded`/`aria-controls`, so
 * keyboard and screen-reader users get the same affordance as pointer users.
 */
export function ParameterGroup({
  title,
  technical = null,
  chip,
  summary,
  expanded,
  onToggle,
  highlight = null,
  children,
  more = null,
  moreLabel = null,
  moreOpen = false,
  onToggleMore
}: ParameterGroupProps) {
  const contentId = useId();
  const moreId = useId();
  const hasMore = more !== null && moreLabel !== null;

  const className = [
    styles.paramGroup,
    highlight === "lesson" ? styles.paramGroupHighlighted : "",
    highlight === "agent" ? styles.paramGroupAgent : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={className} aria-label={title}>
      <h3 className={styles.paramGroupHeading}>
        <button
          type="button"
          className={styles.paramGroupToggle}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => onToggle(!expanded)}
        >
          <span className={styles.paramGroupHeaderLeft}>
            <span className={styles.paramGroupTitle}>{title}</span>
            <span className={styles.paramGroupChip}>
              {expanded ? chip : `${summary.length} MORE`}
            </span>
          </span>
          <span className={styles.paramGroupChevron} aria-hidden="true">
            {expanded ? "⌃" : "⌄"}
          </span>
        </button>
      </h3>

      {technical ? <span className={styles.paramGroupTechnical}>{technical}</span> : null}

      <div id={contentId} hidden={!expanded} className={styles.paramGroupContent}>
        {children}
        {hasMore ? (
          <div id={moreId} hidden={!moreOpen} className={styles.paramGroupContent}>
            {more}
          </div>
        ) : null}
      </div>

      {expanded && hasMore ? (
        <button
          type="button"
          className={styles.moreToggle}
          aria-expanded={moreOpen}
          aria-controls={moreId}
          onClick={() => onToggleMore?.(!moreOpen)}
        >
          {moreOpen ? "− Less" : `+ More  ·  ${moreLabel}`}
        </button>
      ) : null}

      {expanded ? null : (
        <p className={styles.paramGroupSummary}>{summary.join("  ·  ")}</p>
      )}
    </section>
  );
}
