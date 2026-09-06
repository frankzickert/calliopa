import {
  renderToStream,
  type RenderToStreamOptions,
} from "@builder.io/qwik/server";

import Root from "./root";

export default function (options: RenderToStreamOptions) {
  return renderToStream(<Root />, {
    ...options,
    containerAttributes: { lang: "en", ...options.containerAttributes },
  });
}
