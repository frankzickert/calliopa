import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";

import { RouterHead } from "./components/router-head/router-head";
import { THEME_SCRIPT, themeCss } from "./lib/theme";

import "./global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          // `interactive-widget=resizes-content` so an on-screen keyboard shrinks
          // the bounded shell frame rather than covering the command dock.
          content="width=device-width, initial-scale=1, interactive-widget=resizes-content"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <style dangerouslySetInnerHTML={themeCss()} />
        <script dangerouslySetInnerHTML={THEME_SCRIPT} />
        <RouterHead />
      </head>
      <body>
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
