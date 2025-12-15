import { useFeatureSupport } from "@canva/app-hooks";
import {
  Accordion,
  AccordionItem,
  Alert,
  Box,
  Button,
  MultilineInput,
  Rows,
  Text,
  Title,
} from "@canva/app-ui-kit";
import { upload } from "@canva/asset";
import { addElementAtCursor, addElementAtPoint } from "@canva/design";
import { useEffect, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import abcjs from "abcjs";
import * as styles from "styles/components.css";

const DEFAULT_ABC = `X:1
T:Twinkle Twinkle Little Star
M:4/4
L:1/4
K:C
C C G G | A A G2 | F F E E | D D C2 |
G G F F | E E D2 | G G F F | E E D2 |
C C G G | A A G2 | F F E E | D D C2 |
`;

export const App = () => {
  const intl = useIntl();
  const isSupported = useFeatureSupport();
  const addElement = [addElementAtPoint, addElementAtCursor].find((fn) =>
    isSupported(fn)
  );

  const [abcInput, setAbcInput] = useState(DEFAULT_ABC);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasValidNotation, setHasValidNotation] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Normalize ABC input by trimming leading whitespace from each line
  // ABC notation requires header fields to start at column 0
  const normalizeAbcInput = (input: string): string => {
    return input
      .split("\n")
      .map((line) => line.trimStart())
      .join("\n");
  };

  // Render ABC notation whenever input changes
  useEffect(() => {
    if (previewRef.current) {
      try {
        // Clear previous content
        previewRef.current.innerHTML = "";

        const normalizedInput = normalizeAbcInput(abcInput);

        // Only render if there's actual notation (beyond just the header)
        const hasNotes = normalizedInput.split("\n").some((line) => {
          const trimmed = line.trim();
          return (
            trimmed &&
            !trimmed.startsWith("X:") &&
            !trimmed.startsWith("T:") &&
            !trimmed.startsWith("M:") &&
            !trimmed.startsWith("L:") &&
            !trimmed.startsWith("K:") &&
            !trimmed.startsWith("C:") &&
            !trimmed.startsWith("Q:") &&
            !trimmed.startsWith("R:") &&
            !trimmed.startsWith("N:") &&
            !trimmed.startsWith("H:") &&
            !trimmed.startsWith("S:") &&
            !trimmed.startsWith("O:") &&
            !trimmed.startsWith("B:") &&
            !trimmed.startsWith("D:") &&
            !trimmed.startsWith("Z:") &&
            !trimmed.startsWith("G:") &&
            !trimmed.startsWith("F:") &&
            !trimmed.startsWith("P:") &&
            !trimmed.startsWith("I:") &&
            !trimmed.startsWith("W:") &&
            !trimmed.startsWith("w:") &&
            !trimmed.startsWith("V:") &&
            !trimmed.startsWith("%%")
          );
        });

        if (hasNotes) {
          abcjs.renderAbc(previewRef.current, normalizedInput, {
            responsive: "resize",
            foregroundColor: "#000000",
            paddingtop: 30,
            paddingbottom: 10,
            paddingleft: 10,
            paddingright: 10,
            staffwidth: 280,
            format: {
              titlefont: "Arial 16 bold",
            },
          });
          setHasValidNotation(true);
          setError(null);
        } else {
          setHasValidNotation(false);
        }
      } catch {
        setHasValidNotation(false);
        setError(
          intl.formatMessage({
            defaultMessage: "Invalid ABC notation",
            description: "Error message when ABC notation is invalid",
          })
        );
      }
    }
  }, [abcInput, intl]);

  const handleAddToDesign = async () => {
    if (!addElement || !exportRef.current) {
      return;
    }

    // Render a fresh SVG specifically for export (without responsive mode)
    exportRef.current.innerHTML = "";

    const normalizedInput = normalizeAbcInput(abcInput);

    abcjs.renderAbc(exportRef.current, normalizedInput, {
      foregroundColor: "#000000",
      paddingtop: 30,
      paddingbottom: 20,
      paddingleft: 20,
      paddingright: 20,
      staffwidth: 700,
      format: {
        titlefont: "Arial 18 bold",
      },
    });

    const svgElement = exportRef.current.querySelector("svg");
    if (!svgElement) {
      setError(
        intl.formatMessage({
          defaultMessage: "No sheet music to add. Please enter ABC notation.",
          description:
            "Error message when trying to add empty sheet music to design",
        })
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clone the SVG to avoid modifying the export element
      const svgClone = svgElement.cloneNode(true) as SVGElement;

      // Use getBBox to get the actual bounding box of all rendered content
      // This ensures the title and all elements are included
      const bbox = svgElement.getBBox();
      const padding = 20;
      const width = bbox.width + padding * 2;
      const height = bbox.height + padding * 2;

      // Calculate viewBox coordinates with padding
      const viewBoxX = bbox.x - padding;
      const viewBoxY = bbox.y - padding;

      svgClone.setAttribute("width", String(width));
      svgClone.setAttribute("height", String(height));
      svgClone.setAttribute(
        "viewBox",
        `${viewBoxX} ${viewBoxY} ${width} ${height}`
      );

      // Add white background for the exported image
      // Use explicit coordinates matching the viewBox to ensure full coverage
      const bgRect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      bgRect.setAttribute("x", String(viewBoxX));
      bgRect.setAttribute("y", String(viewBoxY));
      bgRect.setAttribute("width", String(width));
      bgRect.setAttribute("height", String(height));
      bgRect.setAttribute("fill", "#ffffff");
      svgClone.insertBefore(bgRect, svgClone.firstChild);

      // Serialize SVG to string
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);

      // Convert to base64 data URL
      const base64 = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${base64}`;

      // Upload to Canva
      const result = await upload({
        type: "image",
        mimeType: "image/svg+xml",
        url: dataUrl,
        thumbnailUrl: dataUrl,
        aiDisclosure: "none",
      });

      // Add to design
      await addElement({
        type: "image",
        ref: result.ref,
        altText: {
          text: intl.formatMessage({
            defaultMessage: "Sheet music",
            description: "Alt text for sheet music image",
          }),
          decorative: false,
        },
      });
    } catch {
      setError(
        intl.formatMessage({
          defaultMessage: "Failed to add sheet music to design",
          description: "Error message when adding sheet music fails",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.scrollContainer}>
      {/* Off-screen container for export rendering */}
      <div
        ref={exportRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "800px",
        }}
      />
      <Rows spacing="2u">
        {/* Collapsible Cheat Sheet */}
        <Accordion>
          <AccordionItem
            title={intl.formatMessage({
              defaultMessage: "ABC syntax reference",
              description: "Title for the ABC notation syntax reference section",
            })}
          >
            <Box padding="1u">
              <Rows spacing="1u">
                <Text size="small">
                  <FormattedMessage
                    defaultMessage="<b>Header:</b> X:1 (tune #) | T:Title | M:4/4 (meter) | K:C (key)"
                    description="Header section in ABC notation cheat sheet"
                    values={{
                      b: (chunks) => <strong>{chunks}</strong>,
                    }}
                  />
                </Text>
                <Text size="small">
                  <FormattedMessage
                    defaultMessage="<b>Notes:</b> C D E F G A B (middle) | c d e f g a b (high) | C, D, (low)"
                    description="Notes section in ABC notation cheat sheet"
                    values={{
                      b: (chunks) => <strong>{chunks}</strong>,
                    }}
                  />
                </Text>
                <Text size="small">
                  <FormattedMessage
                    defaultMessage="<b>Length:</b> A2=half | A4=whole | A/=eighth | z=rest"
                    description="Length section in ABC notation cheat sheet"
                    values={{
                      b: (chunks) => <strong>{chunks}</strong>,
                    }}
                  />
                </Text>
                <Text size="small">
                  <FormattedMessage
                    defaultMessage="<b>Other:</b> |=bar | ^=sharp | _=flat | |: :|=repeat"
                    description="Other section in ABC notation cheat sheet"
                    values={{
                      b: (chunks) => <strong>{chunks}</strong>,
                    }}
                  />
                </Text>
              </Rows>
            </Box>
          </AccordionItem>
        </Accordion>

        {/* ABC Input */}
        <Rows spacing="1u">
          <Title size="small">
            {intl.formatMessage({
              defaultMessage: "ABC notation",
              description: "Label for the ABC notation input field",
            })}
          </Title>
          <MultilineInput
            minRows={8}
            maxRows={12}
            value={abcInput}
            onChange={(value) => setAbcInput(value)}
            placeholder={intl.formatMessage({
              defaultMessage: "Enter ABC notation here...",
              description: "Placeholder for ABC notation input",
            })}
          />
        </Rows>

        {/* Preview */}
        <Rows spacing="1u">
          <Title size="small">
            {intl.formatMessage({
              defaultMessage: "Preview",
              description: "Label for the sheet music preview section",
            })}
          </Title>
          <Box
            background="neutral"
            borderRadius="standard"
            padding="2u"
          >
            <div
              ref={previewRef}
              className={styles.sheetMusicPreview}
            />
          </Box>
        </Rows>

        {/* Error message */}
        {error && (
          <Alert tone="critical">
            {error}
          </Alert>
        )}

        {/* Add to Design button */}
        <Button
          variant="primary"
          onClick={handleAddToDesign}
          disabled={!addElement || isLoading || !hasValidNotation}
          loading={isLoading}
          stretch
          tooltipLabel={
            !addElement
              ? intl.formatMessage({
                  defaultMessage:
                    "This feature is not supported in the current page",
                  description:
                    "Tooltip label for when a feature is not supported in the current design",
                })
              : !hasValidNotation
                ? intl.formatMessage({
                    defaultMessage: "Enter music notation to enable this button",
                    description:
                      "Tooltip label for when there is no valid notation to add",
                  })
                : undefined
          }
        >
          {intl.formatMessage({
            defaultMessage: "Add to design",
            description: "Button text to add sheet music to design",
          })}
        </Button>
      </Rows>
    </div>
  );
};
