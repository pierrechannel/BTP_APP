import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function WorkforcePage() {
  return <ResourcePage resource={resourceByPath["/workforce"]} />;
}
