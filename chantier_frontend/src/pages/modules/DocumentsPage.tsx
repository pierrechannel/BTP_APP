import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function DocumentsPage() {
  return <ResourcePage resource={resourceByPath["/documents"]} />;
}
