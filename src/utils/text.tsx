import React from 'react';

/**
 * Scans text and wraps every Latin run (e.g., "AirPods Pro", "USB-C", "65W", "Casio fx-991EX", "Saad")
 * inside <bdi dir="ltr"> to prevent jumbling line direction in RTL Arabic layout.
 */
export function renderBdi(text?: string | null): React.ReactNode {
  if (!text) return '';

  // Matches runs containing Latin letters (including letters combined with digits, hyphens, slashes, spaces)
  const regex = /([a-zA-Z0-9][a-zA-Z0-9\s\-_.:/+#&]*[a-zA-Z0-9]|[a-zA-Z]+)/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Only wrap if the matched segment contains at least one Latin character [a-zA-Z]
    if (!/[a-zA-Z]/.test(match[0])) {
      continue;
    }

    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    elements.push(
      <bdi key={match.index} dir="ltr" className="inline-block unicode-bidi-isolate">
        {match[0]}
      </bdi>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements.length > 0 ? elements : text;
}
