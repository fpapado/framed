import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Pick image link", () => {
  render(<App />);
  const buttonEl = screen.getByText(/Pick image/i);
  expect(buttonEl).toBeInTheDocument();
});
