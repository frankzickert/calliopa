import { render, type RenderOptions } from "@builder.io/qwik";

import Root from "./root";

export default function (options: RenderOptions) {
  return render(document, <Root />, options);
}
