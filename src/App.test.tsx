import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Pick image button", () => {
  render(<App />);
  const buttonEl = screen.getByText(/Pick image/i);
  expect(buttonEl).toBeInTheDocument();
});
