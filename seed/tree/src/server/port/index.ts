/**
 * The port the build answers. `#port` names the adapter: the Node adapter in
 * `tsconfig.json`, which every build, the dev server and the suites resolve;
 * the device build points it at its own (`CA_0076`). CA_0074_001
 */
export { port } from "#port";
export type {
  ConfigDirectory,
  ConfigFiles,
  Port,
  PortEnvName,
  Scope,
} from "./port";
