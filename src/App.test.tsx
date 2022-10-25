import { render, screen } from "@testing-library/react";
import App from "./App";
import React from "react";

test("renders Pick image button", async () => {
  render(<App />);
  expect(await screen.findByText(/Pick image/i)).toBeInTheDocument();
});
