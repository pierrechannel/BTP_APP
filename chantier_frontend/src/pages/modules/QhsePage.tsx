import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function QhsePage() {
  return <ResourcePage resource={resourceByPath["/qhse"]} />;
}
