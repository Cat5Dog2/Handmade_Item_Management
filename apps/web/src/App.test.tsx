import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the bootstrap screen", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Handmade Item Management" })
    ).toBeInTheDocument();
  });
});
