import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface LatexProps {
  text: string;
}

export function Latex({ text }: LatexProps) {
  if (!text) return null;

  // Split by $$...$$ first, then by $...$
  const blockParts = text.split(/(\$\$[\s\S]+?\$\$)/g);

  return (
    <span>
      {blockParts.map((part, i) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const formula = part.slice(2, -2);
          try {
            const html = katex.renderToString(formula, {
              displayMode: true,
              throwOnError: false,
            });
            return (
              <span
                key={i}
                className="block my-2 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (e) {
            return (
              <code key={i} className="block my-2 p-2 bg-slate-100 rounded text-slate-700 font-mono text-xs">
                {formula}
              </code>
            );
          }
        }

        // Now split by inline math $...$
        const inlineParts = part.split(/(\$[\s\S]+?\$)/g);
        return (
          <React.Fragment key={i}>
            {inlineParts.map((subPart, j) => {
              if (subPart.startsWith("$") && subPart.endsWith("$")) {
                const formula = subPart.slice(1, -1);
                try {
                  const html = katex.renderToString(formula, {
                    displayMode: false,
                    throwOnError: false,
                  });
                  return (
                    <span
                      key={j}
                      className="inline-block mx-0.5"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                } catch (e) {
                  return (
                    <code key={j} className="px-1 bg-slate-100 rounded text-rose-600 font-mono text-xs">
                      {formula}
                    </code>
                  );
                }
              }
              return <span key={j}>{subPart}</span>;
            })}
          </React.Fragment>
        );
      })}
    </span>
  );
}
