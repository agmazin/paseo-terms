import type { PluginClientContext } from "@getpaseo/plugin/client";
import { mountTerms } from "./client/web";

export default function contribute(_client: PluginClientContext) {
  return mountTerms();
}
