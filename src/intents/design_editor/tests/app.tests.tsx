/* eslint-disable formatjs/no-literal-string-in-jsx */
import { useFeatureSupport } from "@canva/app-hooks";
import { TestAppI18nProvider } from "@canva/app-i18n-kit";
import { TestAppUiProvider } from "@canva/app-ui-kit";
import { addElementAtCursor, addElementAtPoint } from "@canva/design";
import type { Feature } from "@canva/platform";
import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { App } from "../app";

function renderInTestProvider(node: ReactNode): RenderResult {
  return render(
    <TestAppI18nProvider>
      <TestAppUiProvider>{node}</TestAppUiProvider>,
    </TestAppI18nProvider>,
  );
}

jest.mock("@canva/app-hooks");

jest.mock("abcjs", () => ({
  renderAbc: jest.fn(),
}));

describe("ABC Music Notation App Tests", () => {
  const mockIsSupported = jest.fn();
  const mockUseFeatureSupport = jest.mocked(useFeatureSupport);

  beforeEach(() => {
    jest.resetAllMocks();
    mockIsSupported.mockImplementation(
      (fn: Feature) => fn === addElementAtPoint,
    );
    mockUseFeatureSupport.mockReturnValue(mockIsSupported);
  });

  it("should render the app with ABC notation input", () => {
    const result = renderInTestProvider(<App />);

    // Check for main UI elements
    expect(result.getByText("ABC Notation")).toBeTruthy();
    expect(result.getByText("Preview")).toBeTruthy();
    expect(result.getByText("Add to Design")).toBeTruthy();
  });

  it("should render the collapsible syntax reference", () => {
    const result = renderInTestProvider(<App />);

    // Check for the accordion with syntax reference
    expect(result.getByText("ABC Syntax Reference")).toBeTruthy();
  });

  it("should use addElementAtPoint when supported", () => {
    renderInTestProvider(<App />);

    expect(mockUseFeatureSupport).toHaveBeenCalled();
    expect(mockIsSupported).toHaveBeenCalledWith(addElementAtPoint);
  });

  it("should check for addElementAtCursor support", () => {
    mockIsSupported.mockImplementation(
      (fn: Feature) => fn === addElementAtCursor,
    );

    renderInTestProvider(<App />);

    expect(mockIsSupported).toHaveBeenCalledWith(addElementAtCursor);
  });

  it("should have a consistent snapshot", () => {
    const result = renderInTestProvider(<App />);
    expect(result.container).toMatchSnapshot();
  });
});
