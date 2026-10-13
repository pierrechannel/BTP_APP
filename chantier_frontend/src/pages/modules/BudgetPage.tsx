import { ResourcePage } from "../ResourcePage";
import { resourceByPath } from "../../resources";

export function BudgetPage() {
  return <ResourcePage resource={resourceByPath["/budget"]} />;
}
