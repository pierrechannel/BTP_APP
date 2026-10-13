import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function ProgressPage() {
  return <ResourcePage resource={resourceByPath["/progress"]} />;
}
