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
  const _previewRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Normalize ABC input by trimming leading whitespace from each line
  // ABC notation requires header fields to start at column 0
  const normalizeAbcInput = (input: string): string => {
    return input
      .split("\n")
      .map((line) => line.trimStart())
      .join("\n");
  };

  // Validate ABC notation whenever input changes
  useEffect(() => {
    const normalizedInput = normalizeAbcInput(abcInput);

    // Check if there's actual notation (beyond just the header)
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
      setHasValidNotation(true);
      setError(null);
    } else {
      setHasValidNotation(false);
    }
  }, [abcInput]);

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
        {/* Preview - hidden but kept for potential future use */}
        {/* <Rows spacing="1u">
          <Text size="medium" variant="bold">
            {intl.formatMessage({
              defaultMessage: "Preview",
              description: "Label for the sheet music preview section",
            })}
          </Text>
          <Box
            background="neutral"
            borderRadius="standard"
            padding="2u"
          >
            <div
              ref={_previewRef}
              className={styles.sheetMusicPreview}
            />
          </Box>
        </Rows> */}

        {/* ABC Input */}
        <Rows spacing="1u">
          <Text size="medium" variant="bold">
            {intl.formatMessage({
              defaultMessage: "ABC notation",
              description: "Label for the ABC notation input field",
            })}
          </Text>
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

        {/* Collapsible Cheat Sheet */}
        <Accordion>
          <AccordionItem
            title={intl.formatMessage({
              defaultMessage: "ABC syntax reference",
              description: "Title for the ABC notation syntax reference section",
            })}
          >
            <Box padding="1u">
              <Rows spacing="1.5u">
                {/* Header section */}
                <Rows spacing="0.5u">
                  <Text size="medium" variant="bold">
                    <FormattedMessage
                      defaultMessage="Header"
                      description="Header section label in ABC notation cheat sheet"
                    />
                  </Text>
                  <ul className={styles.syntaxList}>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="X:1"
                          description="ABC syntax code for tune number - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Tune number"
                          description="Tune number description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="T:"
                          description="ABC syntax code for title - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Title"
                          description="Title description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="M:4/4"
                          description="ABC syntax code for meter - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Meter"
                          description="Meter description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="K:C"
                          description="ABC syntax code for key - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Key"
                          description="Key description"
                        />
                      </Text>
                    </li>
                  </ul>
                </Rows>

                {/* Notes section */}
                <Rows spacing="0.5u">
                  <Text size="medium" variant="bold">
                    <FormattedMessage
                      defaultMessage="Notes"
                      description="Notes section label in ABC notation cheat sheet"
                    />
                  </Text>
                  <ul className={styles.syntaxList}>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="C D E F G A B"
                          description="ABC syntax for middle octave notes - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Middle octave"
                          description="Middle octave notes"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="c d e f g a b"
                          description="ABC syntax for high octave notes - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="High octave"
                          description="High octave notes"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="C, D,"
                          description="ABC syntax for low octave notes - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Low octave"
                          description="Low octave notes"
                        />
                      </Text>
                    </li>
                  </ul>
                </Rows>

                {/* Length section */}
                <Rows spacing="0.5u">
                  <Text size="medium" variant="bold">
                    <FormattedMessage
                      defaultMessage="Length"
                      description="Length section label in ABC notation cheat sheet"
                    />
                  </Text>
                  <ul className={styles.syntaxList}>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="A2"
                          description="ABC syntax for half note - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Half note"
                          description="Half note description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="A4"
                          description="ABC syntax for whole note - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Whole note"
                          description="Whole note description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="A/"
                          description="ABC syntax for eighth note - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Eighth note"
                          description="Eighth note description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="z"
                          description="ABC syntax for rest - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Rest"
                          description="Rest description"
                        />
                      </Text>
                    </li>
                  </ul>
                </Rows>

                {/* Symbols section */}
                <Rows spacing="0.5u">
                  <Text size="medium" variant="bold">
                    <FormattedMessage
                      defaultMessage="Symbols"
                      description="Symbols section label in ABC notation cheat sheet"
                    />
                  </Text>
                  <ul className={styles.syntaxList}>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="|"
                          description="ABC syntax for bar line - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Bar line"
                          description="Bar line description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="^"
                          description="ABC syntax for sharp - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Sharp"
                          description="Sharp description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="_"
                          description="ABC syntax for flat - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Flat"
                          description="Flat description"
                        />
                      </Text>
                    </li>
                    <li>
                      <span className={styles.syntaxCode}>
                        <FormattedMessage
                          defaultMessage="|: :|"
                          description="ABC syntax for repeat - do not translate"
                        />
                      </span>
                      <Text size="medium">
                        <FormattedMessage
                          defaultMessage="Repeat"
                          description="Repeat description"
                        />
                      </Text>
                    </li>
                  </ul>
                </Rows>
              </Rows>
            </Box>
          </AccordionItem>
        </Accordion>

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
