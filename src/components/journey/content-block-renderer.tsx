"use client";

import DOMPurify from "isomorphic-dompurify";
import { ExternalLink, FileText, ClipboardList } from "lucide-react";
import type { ContentBlock } from "@/lib/journey-engine/types";
import type { ChecklistState } from "@/app/actions/update-checklist";
import { StepChecklist } from "./step-checklist";

interface UserVariables {
  firstName?: string;
  fullName?: string;
  corporateEmail?: string;
  personalEmail?: string;
  clusterName?: string;
  countryName?: string;
  position?: string;
}

interface ContentBlockRendererProps {
  block: ContentBlock;
  userVariables?: UserVariables;
  userJourneyStepId?: string;
  checklistState?: ChecklistState;
}

function interpolateVariables(html: string, vars: UserVariables): string {
  return html.replace(/\{\{user\.(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key as keyof UserVariables];
    return value ?? `{{user.${key}}}`;
  });
}

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "a",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "span",
      "blockquote",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
  });
}

function RichTextBlock({
  block,
  userVariables,
}: {
  block: ContentBlock;
  userVariables: UserVariables;
}) {
  const interpolated = interpolateVariables(block.value, userVariables);
  const clean = sanitizeHtml(interpolated);

  return (
    <div
      className="prose prose-sm prose-zinc max-w-none text-xs leading-relaxed [&_p]:my-1 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function VideoEmbedBlock({ block }: { block: ContentBlock }) {
  const label = block.meta?.label;

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-zinc-100">
        <iframe
          src={block.value}
          title={label ?? "Video"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function PdfLinkBlock({ block }: { block: ContentBlock }) {
  const label = block.meta?.label ?? "Ver documento";

  return (
    <a
      href={block.value}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-muted/80"
    >
      <FileText className="h-4 w-4 shrink-0" />
      {label}
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
    </a>
  );
}

function FormLinkBlock({ block }: { block: ContentBlock }) {
  const label = block.meta?.label ?? "Ir al formulario";

  return (
    <a
      href={block.value}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <ClipboardList className="h-4 w-4 shrink-0" />
      {label}
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
    </a>
  );
}

function ChecklistBlock({
  block,
  userJourneyStepId,
  checklistState,
}: {
  block: ContentBlock;
  userJourneyStepId?: string;
  checklistState?: ChecklistState;
}) {
  const items = block.meta?.checklistItems ?? [];
  if (items.length === 0) return null;

  if (!userJourneyStepId) {
    return (
      <div className="space-y-1.5">
        {block.meta?.label && (
          <p className="text-xs font-medium text-muted-foreground">
            {block.meta.label}
          </p>
        )}
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <span className="mt-0.5">-</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <StepChecklist
      label={block.meta?.label}
      items={items}
      userJourneyStepId={userJourneyStepId}
      initialState={checklistState ?? {}}
    />
  );
}

export function ContentBlockRenderer({
  block,
  userVariables = {},
  userJourneyStepId,
  checklistState,
}: ContentBlockRendererProps) {
  switch (block.type) {
    case "RICH_TEXT":
      return <RichTextBlock block={block} userVariables={userVariables} />;
    case "VIDEO_EMBED":
      return <VideoEmbedBlock block={block} />;
    case "PDF_LINK":
      return <PdfLinkBlock block={block} />;
    case "FORM_LINK":
      return <FormLinkBlock block={block} />;
    case "CHECKLIST":
      return (
        <ChecklistBlock
          block={block}
          userJourneyStepId={userJourneyStepId}
          checklistState={checklistState}
        />
      );
    default:
      return null;
  }
}
